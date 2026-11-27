ALTER TABLE `TrendyCollection` ADD COLUMN `images` JSON NULL;

UPDATE `TrendyCollection` SET `images` = JSON_ARRAY(`imageUrl`) WHERE `images` IS NULL;
