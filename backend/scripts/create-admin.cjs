require("dotenv/config");

const readline = require("node:readline");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function askHidden(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    return Promise.reject(new Error("Run this command in an interactive terminal so the password can be hidden."));
  }

  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let value = "";
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };

    const onData = (key) => {
      if (key === "\u0003") {
        cleanup();
        reject(new Error("Admin creation cancelled."));
      } else if (key === "\r" || key === "\n") {
        cleanup();
        resolve(value);
      } else if (key === "\u0008" || key === "\u007f") {
        if (value.length) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (key >= " " && key !== "\u007f") {
        value += key;
        process.stdout.write("*");
      }
    };

    stdin.on("data", onData);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing. Configure backend/.env first.");
  }

  console.log("\nSTITCHGRID — Create Admin Account\n");
  const fullName = await ask("Admin full name: ");
  const email = (await ask("Admin email (use this as username at login): ")).toLowerCase();
  const organizationName = "STITCHGRID Platform Administration";
  const password = await askHidden("Admin password (minimum 10 characters): ");
  const confirmPassword = await askHidden("Confirm password: ");

  if (fullName.length < 2) throw new Error("Full name must contain at least 2 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (password.length < 10 || password.length > 128) throw new Error("Password must be 10–128 characters.");
  if (password !== confirmPassword) throw new Error("Passwords do not match.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("This email is already registered. No changes were made. Use a new admin email.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        emailVerified: true,
        isActive: true,
      },
    });

    const organization = await tx.organization.create({
      data: { name: organizationName },
    });

    await tx.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "ADMIN",
        isActive: true,
      },
    });

    return { userId: user.id, organizationId: organization.id };
  });

  console.log("\nAdmin account created successfully.");
  console.log("Login username:", email);
  console.log("Role: ADMIN");
  console.log("Next: open your STITCHGRID website login page and sign in with this email and password.");
  console.log("Admin dashboard: /admin");
  console.log("\nKeep these credentials private.\n");
  return result;
}

main()
  .catch((error) => {
    console.error("\nAdmin account was not created:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
