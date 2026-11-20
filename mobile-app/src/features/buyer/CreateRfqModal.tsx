import { ui } from '@/theme/ui';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { apiPost } from '@/services/api';

const PURPLE = ui.accent;
type Section = 'product' | 'quantity' | 'delivery';
type Props = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  supplierOrgId?: string;
  supplierName?: string;
};

const CATEGORIES = ['Garment (Apparel)', 'Fabric (Textiles & Knits)', 'Trims & Accessories', 'Job Work & Processing'];
const PRODUCT_TYPES: Record<string, string[]> = {
  'Garment (Apparel)': ['T-Shirt', 'Hoodie / Sweatshirt', 'Polo Shirt', 'Shirts / Tops', 'Trousers / Joggers', 'Activewear', 'Custom Garment'],
  'Fabric (Textiles & Knits)': ['Cotton Fabric', 'Single Jersey', 'Fleece', 'Denim', 'Polyester Fabric', 'Custom Fabric'],
  'Trims & Accessories': ['Labels', 'Buttons', 'Zippers', 'Elastic', 'Threads', 'Packaging'],
  'Job Work & Processing': ['Cutting', 'Stitching', 'Printing', 'Embroidery', 'Washing', 'Finishing', 'Packing'],
};
const UNITS = ['Pieces', 'Meters', 'Kg', 'Sets'];

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType = 'default', required = false }: {
  label: string; value: string; onChangeText: (v: string) => void; placeholder?: string;
  multiline?: boolean; keyboardType?: 'default' | 'numeric'; required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? <Text style={styles.required}> *</Text> : null}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ui.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[styles.input, multiline && styles.textArea]}
      />
    </View>
  );
}

function ChoiceField({ label, value, options, onSelect, icon }: {
  label: string; value: string; options: string[]; onSelect: (v: string) => void; icon?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}<Text style={styles.required}> *</Text></Text>
      <Pressable style={styles.choice} onPress={() => setOpen(!open)}>
        {icon ? <MaterialCommunityIcons name={icon as any} size={23} color={PURPLE} /> : null}
        <Text numberOfLines={1} style={styles.choiceText}>{value}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color="#98A0AA" />
      </Pressable>
      {open && (
        <View style={styles.options}>
          {options.map(option => (
            <Pressable key={option} style={styles.option} onPress={() => { onSelect(option); setOpen(false); }}>
              <Text style={[styles.optionText, option === value && styles.optionSelected]}>{option}</Text>
              {option === value ? <MaterialCommunityIcons name="check" size={19} color={PURPLE} /> : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function SectionCard({ title, icon, expanded, onToggle, children }: {
  title: string; icon: string; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <Pressable style={styles.sectionHeader} onPress={onToggle}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name={icon as any} size={25} color={PURPLE} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <MaterialCommunityIcons name={expanded ? 'chevron-up' : 'chevron-down'} size={23} color="#9AA1AA" />
      </Pressable>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

export default function CreateRfqModal({ visible, onClose, onSuccess, supplierOrgId, supplierName }: Props) {
  const [title, setTitle] = useState(supplierName ? `Sourcing Order for ${supplierName}` : '5,000 Oversized T-Shirts');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [productType, setProductType] = useState('T-Shirt');
  const [fabricSpec, setFabricSpec] = useState('240 GSM, 100% Cotton Single Jersey');
  const [colors, setColors] = useState(['Black', 'White', 'Navy', 'Grey']);
  const [newColor, setNewColor] = useState('');
  const [addingColor, setAddingColor] = useState(false);
  const [fileName] = useState('');
  const [totalQuantity, setTotalQuantity] = useState('5000');
  const [unit, setUnit] = useState('Pieces');
  const [sizes, setSizes] = useState({ S: '500', M: '1250', L: '1500', XL: '1000', XXL: '750' });
  const [details, setDetails] = useState('Sample: Yes (5 pcs) | Quality: AQL 2.5 | Packaging: Individual polybag, size sticker, 20 pcs per carton | Additional: Custom woven label, brand tag, and export quality stitching.');
  const [deliveryDate, setDeliveryDate] = useState('2026-12-20');
  const [deliveryLocation, setDeliveryLocation] = useState('Noida, Uttar Pradesh – 201301');
  const [quoteDeadline, setQuoteDeadline] = useState('2026-11-27');
  const [expanded, setExpanded] = useState<Record<Section, boolean>>({ product: true, quantity: true, delivery: true });
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'PUBLISH' | 'DRAFT'>('PUBLISH');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const sizeSum = useMemo(() => Object.values(sizes).reduce((sum, n) => sum + (Number(n) || 0), 0), [sizes]);

  useEffect(() => {
    if (visible) {
      setTitle(supplierName ? `Sourcing Order for ${supplierName}` : '5,000 Oversized T-Shirts');
      setError('');
      setSuccess('');
    }
  }, [visible, supplierName]);

  const close = () => {
    if (submitting) return;
    setError('');
    setSuccess('');
    onClose();
  };

  const submit = async (submitMode: 'PUBLISH' | 'DRAFT') => {
    setError('');
    setSuccess('');
    // The existing POST /rfqs API requires a title (min 3 chars) and a positive integer quantity for both drafts and published RFQs.
    if (title.trim().length < 3) return setError('Please enter an RFQ title with at least 3 characters.');
    if (!Number.isInteger(Number(totalQuantity)) || Number(totalQuantity) <= 0) return setError('Total quantity must be greater than 0.');
    if (submitMode === 'PUBLISH') {
      if (!fabricSpec.trim()) return setError('Please specify the Fabric / Material specification.');
      if (!deliveryLocation.trim()) return setError('Please enter the delivery location.');
      if (!details.trim()) return setError('Please enter the requirement details.');
    }
    try {
      setSubmitting(true);
      setMode(submitMode);
      const membershipRaw = await SecureStore.getItemAsync('sg_membership');
      const membership = membershipRaw ? JSON.parse(membershipRaw) : null;
      const buyerOrgId = membership?.organizationId || membership?.organization?.id;
      if (!buyerOrgId) throw new Error('Buyer organization membership was not found. Please sign in again.');
      const sizesString = `S:${sizes.S}, M:${sizes.M}, L:${sizes.L}, XL:${sizes.XL}, XXL:${sizes.XXL}`;
      const colorString = colors.join(', ');
      const description = [
        details.trim(),
        `Sizes: ${sizesString}`,
        `Colorways: ${colorString}`,
        `Delivery Location: ${deliveryLocation.trim()}`,
        `Quote Deadline: ${quoteDeadline}`,
        fileName ? `Tech Pack File: ${fileName}` : null,
      ].filter(Boolean).join(' | ');
      const date = deliveryDate ? new Date(`${deliveryDate}T12:00:00`).toISOString() : undefined;
      await apiPost('/rfqs', {
        buyerOrgId,
        title: title.trim(),
        garmentType: productType || category,
        fabricSpec: fabricSpec.trim(),
        targetQuantity: Number(totalQuantity),
        targetDate: date,
        status: submitMode === 'DRAFT' ? 'DRAFT' : 'OPEN',
        supplierOrgIds: supplierOrgId ? [supplierOrgId] : undefined,
        description,
        items: [{
          name: `${productType} - ${title.trim()}`,
          description: `Fabric: ${fabricSpec}. Colors: ${colorString}. Sizes: ${sizesString}. Location: ${deliveryLocation}`,
          quantity: Number(totalQuantity),
          unit: unit.toLowerCase(),
        }],
      });
      setSuccess(submitMode === 'DRAFT' ? 'RFQ saved as draft successfully!' : 'RFQ published successfully! Verified suppliers can now submit quotations.');
      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess('');
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit RFQ. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = (section: Section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView style={styles.modalOuter} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={styles.headerIntro}>
                <View style={styles.headerIcon}><MaterialCommunityIcons name="clipboard-text-outline" size={27} color={PURPLE} /></View>
                <View style={styles.headerCopy}>
                  <Text style={styles.modalTitle}>Post New RFQ</Text>
                  <Text style={styles.subtitle}>Publish your sourcing requirement and receive quotes from verified suppliers.</Text>
                </View>
              </View>
              <Pressable onPress={close} disabled={submitting} hitSlop={10} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={27} color="#9AA1AA" />
              </Pressable>
            </View>

            {!!error && <View style={styles.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={19} color="#B42318" /><Text style={styles.errorText}>{error}</Text></View>}
            {!!success && <View style={styles.successBox}><MaterialCommunityIcons name="check-circle-outline" size={19} color="#16804A" /><Text style={styles.successText}>{success}</Text></View>}

            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <SectionCard title="Product Details" icon="hanger" expanded={expanded.product} onToggle={() => toggle('product')}>
                <Field label="RFQ Title" required value={title} onChangeText={setTitle} placeholder="e.g. 5,000 Oversized T-Shirts" />
                <ChoiceField label="Product Category" value={category} options={CATEGORIES} onSelect={value => { setCategory(value); setProductType(PRODUCT_TYPES[value][0]); }} icon="hanger" />
                <ChoiceField label="Product Type" value={productType} options={PRODUCT_TYPES[category]} onSelect={setProductType} />
                <Field label="Fabric / Material Specification" required value={fabricSpec} onChangeText={setFabricSpec} placeholder="e.g. 240 GSM, 100% Cotton Single Jersey" />
                <View style={styles.field}>
                  <Text style={styles.label}>Colorways</Text>
                  <View style={styles.colorBox}>
                    <View style={styles.chips}>{colors.map(color => (
                      <View key={color} style={styles.colorChip}><Text style={styles.colorText}>{color}</Text><Pressable onPress={() => setColors(prev => prev.filter(c => c !== color))}><MaterialCommunityIcons name="close" size={15} color="#9299A3" /></Pressable></View>
                    ))}</View>
                    {addingColor ? (
                      <View style={styles.addColorRow}>
                        <TextInput value={newColor} onChangeText={setNewColor} placeholder="Color name" style={styles.addColorInput} />
                        <Pressable onPress={() => { const c = newColor.trim(); if (c && !colors.includes(c)) setColors(prev => [...prev, c]); setNewColor(''); setAddingColor(false); }}><Text style={styles.addColorAction}>Add</Text></Pressable>
                        <Pressable onPress={() => setAddingColor(false)}><MaterialCommunityIcons name="close" size={19} color="#888" /></Pressable>
                      </View>
                    ) : <Pressable style={styles.addColorButton} onPress={() => setAddingColor(true)}><MaterialCommunityIcons name="plus" size={22} color={PURPLE} /><Text style={styles.addColorAction}>Add Color</Text></Pressable>}
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Upload Design / Tech Pack (Optional)</Text>
                  <Pressable style={styles.uploadBox} onPress={() => Alert.alert('Tech pack attachments', 'File uploads are not available in this mobile form. Include the relevant specifications in Requirement Details before publishing.')}>
                    <View style={styles.uploadIcon}><MaterialCommunityIcons name="information-outline" size={26} color={PURPLE} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.uploadLink}>{fileName || 'About tech-pack attachments'}</Text>
                      <Text style={styles.uploadHint}>File uploads are not available here yet; include specifications below.</Text>
                    </View>
                  </Pressable>
                </View>
              </SectionCard>

              <SectionCard title="Quantity & Specifications" icon="layers-outline" expanded={expanded.quantity} onToggle={() => toggle('quantity')}>
                <Field label="Total Quantity" required value={totalQuantity} onChangeText={setTotalQuantity} keyboardType="numeric" placeholder="5000" />
                <ChoiceField label="Unit" value={unit} options={UNITS} onSelect={setUnit} />
                <View style={styles.field}>
                  <View style={styles.sizeHeader}><Text style={styles.label}>Size-wise Quantity (Optional)</Text><Pressable accessibilityRole="button" accessibilityLabel={`Set total quantity to ${sizeSum}`} style={{ minHeight: 44, justifyContent: 'center' }} onPress={() => setTotalQuantity(String(sizeSum))}><Text style={styles.syncText}>Set Total to {sizeSum.toLocaleString('en-IN')}</Text></Pressable></View>
                  <View style={styles.sizeGrid}>
                    {(['S','M','L','XL','XXL'] as const).map(size => (
                      <View key={size} style={styles.sizeCell}><Text style={styles.sizeLabel}>{size}</Text><TextInput accessibilityLabel={`Quantity for size ${size}`} keyboardType="numeric" value={sizes[size]} onChangeText={value => setSizes(prev => ({ ...prev, [size]: value }))} style={styles.sizeInput} /></View>
                    ))}
                  </View>
                </View>
                <View style={styles.field}>
                  <View style={styles.sizeHeader}><Text style={styles.label}>Requirement Details<Text style={styles.required}> *</Text></Text><Text style={styles.counter}>{details.length} / 500</Text></View>
                  <TextInput value={details} onChangeText={value => setDetails(value.slice(0, 500))} multiline maxLength={500} textAlignVertical="top" style={[styles.input, styles.textArea]} placeholder="Sample, quality, packaging and additional requirements..." />
                </View>
              </SectionCard>

              <SectionCard title="Delivery & Publish" icon="truck-outline" expanded={expanded.delivery} onToggle={() => toggle('delivery')}>
                <Field label="Target Delivery Date" required value={deliveryDate} onChangeText={setDeliveryDate} placeholder="YYYY-MM-DD" />
                <Field label="Delivery Location" required value={deliveryLocation} onChangeText={setDeliveryLocation} placeholder="Noida, Uttar Pradesh – 201301" />
                <Field label="Quote Submission Deadline" required value={quoteDeadline} onChangeText={setQuoteDeadline} placeholder="YYYY-MM-DD" />
              </SectionCard>
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={[styles.draftButton, submitting && styles.disabled]} onPress={() => submit('DRAFT')} disabled={submitting}>
                {submitting && mode === 'DRAFT' ? <ActivityIndicator color={PURPLE} size="small" /> : <MaterialCommunityIcons name="bookmark-outline" size={21} color={PURPLE} />}
                <Text style={styles.draftText}>{submitting && mode === 'DRAFT' ? 'Saving Draft...' : 'Save as Draft'}</Text>
              </Pressable>
              <Pressable style={[styles.publishButton, submitting && styles.disabled]} onPress={() => submit('PUBLISH')} disabled={submitting}>
                {submitting && mode === 'PUBLISH' ? <ActivityIndicator color="#FFFFFF" size="small" /> : <MaterialCommunityIcons name="send-outline" size={21} color="#FFFFFF" />}
                <Text style={styles.publishText}>{submitting && mode === 'PUBLISH' ? 'Publishing RFQ...' : 'Publish RFQ'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:{flex:1,backgroundColor:'rgba(0,0,0,.52)',justifyContent:'center',alignItems:'center',paddingTop:12,paddingBottom:12},
  modalOuter:{width:'96%',height:'94%',maxWidth:680},
  modal:{flex:1,backgroundColor:ui.surface,borderRadius:27,borderWidth:1,borderColor:'#ECECF0',overflow:'hidden',paddingHorizontal:15,paddingTop:16,paddingBottom:12},
  modalHeader:{flexDirection:'row',alignItems:'flex-start',gap:9,paddingBottom:14,borderBottomWidth:1,borderBottomColor:'#F0F0F2'},
  headerIntro:{flex:1,flexDirection:'row',alignItems:'center',gap:11},
  headerIcon:{width:47,height:47,borderRadius:16,backgroundColor:'#F7F1FF',alignItems:'center',justifyContent:'center'},
  headerCopy:{flex:1},
  modalTitle:{fontSize:20,fontWeight: '700',color:'#151923'},
  subtitle:{fontSize:13,lineHeight:19,color:'#737B87',marginTop:3},
  closeButton:{width:48,height:48,alignItems:'center',justifyContent:'center'},
  formScroll:{flex:1},
  formContent:{paddingTop:14,paddingBottom:12,gap:13},
  sectionCard:{borderWidth:1,borderColor:'#E7E7EB',borderRadius:21,padding:14,backgroundColor:ui.surface},
  sectionHeader:{minHeight:34,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  sectionTitleRow:{flexDirection:'row',alignItems:'center',gap:11},
  sectionTitle:{fontSize:16,fontWeight: '700',color:'#191D27'},
  sectionBody:{paddingTop:12,gap:13},
  field:{gap:7},
  label:{fontSize:13,fontWeight: '700',color:'#303642'},
  required:{color:'#D92D20'},
  input:{minHeight:48,borderWidth:1,borderColor:'#E0E1E5',borderRadius:12,paddingHorizontal:13,paddingVertical:10,fontSize:14,color:'#252B35',backgroundColor:ui.surface},
  textArea:{minHeight:100,paddingTop:12,lineHeight:21},
  choice:{minHeight:49,borderWidth:1,borderColor:'#E0E1E5',borderRadius:12,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:9},
  choiceText:{flex:1,fontSize:14,color:'#252B35'},
  options:{borderWidth:1,borderColor:'#E7E4ED',borderRadius:13,overflow:'hidden',backgroundColor:ui.surface},
  option:{minHeight:43,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#F1F1F3'},
  optionText:{fontSize:13,color:'#4B5360'},
  optionSelected:{color:PURPLE,fontWeight: '700'},
  colorBox:{minHeight:64,borderWidth:1,borderColor:'#E0E1E5',borderRadius:14,padding:10,gap:9},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7},
  colorChip:{backgroundColor:'#F1F2F4',borderRadius:9,paddingHorizontal:10,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:5},
  colorText:{fontSize:13,color:'#303642'},
  addColorButton:{flexDirection:'row',alignItems:'center',alignSelf:'flex-start',gap:5,paddingVertical:3},
  addColorAction:{fontSize:14,fontWeight: '700',color:PURPLE},
  addColorRow:{flexDirection:'row',alignItems:'center',gap:9},
  addColorInput:{height:36,minWidth:120,borderWidth:1,borderColor:'#D8C8F7',borderRadius:9,paddingHorizontal:9,color:'#222',flex:1},
  uploadBox:{minHeight:76,borderWidth:1,borderStyle:'solid',borderColor:ui.border,borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:ui.surfaceMuted},
  uploadIcon:{width:43,height:43,borderRadius:13,backgroundColor:'#F1E9FF',alignItems:'center',justifyContent:'center'},
  uploadLink:{fontSize:14,fontWeight:'600',color:ui.ink},
  uploadHint:{fontSize: 13,color:ui.muted,marginTop:4},
  sizeHeader:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},
  syncText:{fontSize:13,fontWeight: '700',color:PURPLE},
  sizeGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},
  sizeCell:{flexGrow:1,flexBasis:'18%',minWidth:68,alignItems:'center',gap:5},
  sizeLabel:{fontSize: 13,fontWeight: '700',color:'#737B87'},
  sizeInput:{width:'100%',minHeight:48,borderWidth:1,borderColor:'#E0E1E5',borderRadius:10,textAlign:'center',fontSize:13,fontWeight:'700',color:'#242A34',paddingHorizontal:2},
  counter:{fontSize: 12,color:ui.muted},
  footer:{paddingTop:11,borderTopWidth:1,borderTopColor:'#EEEEF1',gap:9},
  draftButton:{minHeight:47,borderRadius:13,backgroundColor:'#F3EDFF',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},
  draftText:{fontSize:14,fontWeight: '700',color:PURPLE},
  publishButton:{minHeight:49,borderRadius:13,backgroundColor:PURPLE,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},
  publishText:{fontSize:15,fontWeight: '700',color:ui.surface},
  disabled:{opacity:.55},
  errorBox:{marginTop:10,padding:10,borderRadius:11,backgroundColor:'#FFF1F0',flexDirection:'row',alignItems:'center',gap:8},
  errorText:{flex:1,fontSize: 13,color:'#B42318',lineHeight:17},
  successBox:{marginTop:10,padding:10,borderRadius:11,backgroundColor:'#ECFDF3',flexDirection:'row',alignItems:'center',gap:8},
  successText:{flex:1,fontSize: 13,color:'#16804A',lineHeight:17,fontWeight:'700'},
});