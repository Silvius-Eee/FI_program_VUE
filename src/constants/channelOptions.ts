export const supportedProductOptions = [
  { value: 'Payin', label: 'Payin' },
  { value: 'Payout', label: 'Payout' },
  { value: 'Issuing Cards', label: 'Issuing Cards' },
  { value: "I'm not sure yet", label: "I'm not sure yet" },
];

export const geoData: Record<string, string[]> = {
  Europe: ['UK', 'Germany', 'France', 'Ireland'],
  Asia: ['Singapore', 'Hong Kong', 'Japan'],
  Americas: ['USA', 'Canada', 'Brazil'],
};

export const contactMethodOptions = [
  { value: 'WeCom', label: 'WeCom', placeholder: 'e.g., JaneID_123' },
  { value: 'Email', label: 'Email', placeholder: 'e.g., jane.doe@example.com' },
  { value: 'WhatsApp', label: 'WhatsApp', placeholder: 'e.g., +1 234 567 890' },
  { value: 'Telegram', label: 'Telegram', placeholder: 'e.g., @janedoe' },
  { value: 'Other', label: 'Other', placeholder: 'Specify method and contact details' },
];

export const merchantGeoOptions = [
  { value: 'Global', label: 'Global' },
  ...Object.keys(geoData).map(continent => ({
    value: continent,
    label: continent,
    children: geoData[continent].map(country => ({
      value: country,
      label: country,
    })),
  }))
];
