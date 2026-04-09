export const GEO_SCOPE_KIND_ALL = 'ALL';
export const GEO_SCOPE_KIND_PARTIAL = 'PARTIAL';
export const GEO_SCOPE_GLOBAL_LABEL = 'Global';
export const DEFAULT_GEO_PROVIDER = 'GLOBAL';

interface Tag {
  taxonomy: string;
  provider: string;
  tagCode: string;
  tagName?: string;
}

interface CountryDefinition {
  countryCode: string;
  countryNameEn: string;
  countryNameZh: string;
  aliases: string[];
  tags: Tag[];
}

const COUNTRY_DEFINITIONS: CountryDefinition[] = [
  {
    countryCode: 'GB',
    countryNameEn: 'United Kingdom',
    countryNameZh: '英国',
    aliases: ['GB', 'UK', 'United Kingdom', 'Britain'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'EUROPE', tagName: 'Europe' },
      { taxonomy: 'payment_zone', provider: 'GLOBAL', tagCode: 'SEPA', tagName: 'SEPA' },
    ],
  },
  {
    countryCode: 'DE',
    countryNameEn: 'Germany',
    countryNameZh: '德国',
    aliases: ['DE', 'Germany'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'EUROPE', tagName: 'Europe' },
      { taxonomy: 'economic_zone', provider: 'GLOBAL', tagCode: 'EU', tagName: 'EU' },
      { taxonomy: 'economic_zone', provider: 'GLOBAL', tagCode: 'EEA', tagName: 'EEA' },
      { taxonomy: 'payment_zone', provider: 'GLOBAL', tagCode: 'SEPA', tagName: 'SEPA' },
    ],
  },
  {
    countryCode: 'FR',
    countryNameEn: 'France',
    countryNameZh: '法国',
    aliases: ['FR', 'France'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'EUROPE', tagName: 'Europe' },
      { taxonomy: 'economic_zone', provider: 'GLOBAL', tagCode: 'EU', tagName: 'EU' },
      { taxonomy: 'economic_zone', provider: 'GLOBAL', tagCode: 'EEA', tagName: 'EEA' },
      { taxonomy: 'payment_zone', provider: 'GLOBAL', tagCode: 'SEPA', tagName: 'SEPA' },
    ],
  },
  {
    countryCode: 'IE',
    countryNameEn: 'Ireland',
    countryNameZh: '爱尔兰',
    aliases: ['IE', 'Ireland'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'EUROPE', tagName: 'Europe' },
      { taxonomy: 'economic_zone', provider: 'GLOBAL', tagCode: 'EU', tagName: 'EU' },
      { taxonomy: 'economic_zone', provider: 'GLOBAL', tagCode: 'EEA', tagName: 'EEA' },
      { taxonomy: 'payment_zone', provider: 'GLOBAL', tagCode: 'SEPA', tagName: 'SEPA' },
    ],
  },
  {
    countryCode: 'US',
    countryNameEn: 'United States',
    countryNameZh: '美国',
    aliases: ['US', 'USA', 'United States', 'United States of America'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'AMERICAS', tagName: 'Americas' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'NORTH_AMERICA', tagName: 'North America' },
    ],
  },
  {
    countryCode: 'CA',
    countryNameEn: 'Canada',
    countryNameZh: '加拿大',
    aliases: ['CA', 'Canada'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'AMERICAS', tagName: 'Americas' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'NORTH_AMERICA', tagName: 'North America' },
    ],
  },
  {
    countryCode: 'BR',
    countryNameEn: 'Brazil',
    countryNameZh: '巴西',
    aliases: ['BR', 'Brazil'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'AMERICAS', tagName: 'Americas' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'LATAM', tagName: 'LATAM' },
      { taxonomy: 'provider_region', provider: 'STRIPE', tagCode: 'LATAM', tagName: 'LATAM' },
    ],
  },
  {
    countryCode: 'UY',
    countryNameEn: 'Uruguay',
    countryNameZh: '乌拉圭',
    aliases: ['UY', 'Uruguay'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'AMERICAS', tagName: 'Americas' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'LATAM', tagName: 'LATAM' },
      { taxonomy: 'provider_region', provider: 'STRIPE', tagCode: 'LATAM', tagName: 'LATAM' },
    ],
  },
  {
    countryCode: 'CO',
    countryNameEn: 'Colombia',
    countryNameZh: '哥伦比亚',
    aliases: ['CO', 'Colombia'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'AMERICAS', tagName: 'Americas' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'LATAM', tagName: 'LATAM' },
      { taxonomy: 'provider_region', provider: 'STRIPE', tagCode: 'LATAM', tagName: 'LATAM' },
    ],
  },
  {
    countryCode: 'MX',
    countryNameEn: 'Mexico',
    countryNameZh: '墨西哥',
    aliases: ['MX', 'Mexico'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'AMERICAS', tagName: 'Americas' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'NORTH_AMERICA', tagName: 'North America' },
      { taxonomy: 'provider_region', provider: 'STRIPE', tagCode: 'LATAM', tagName: 'LATAM' },
    ],
  },
  {
    countryCode: 'SG',
    countryNameEn: 'Singapore',
    countryNameZh: '新加坡',
    aliases: ['SG', 'Singapore'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'ASIA', tagName: 'Asia' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'APAC', tagName: 'APAC' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'ASEAN', tagName: 'ASEAN' },
    ],
  },
  {
    countryCode: 'HK',
    countryNameEn: 'Hong Kong',
    countryNameZh: '中国香港',
    aliases: ['HK', 'Hong Kong'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'ASIA', tagName: 'Asia' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'APAC', tagName: 'APAC' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'GREATER_CHINA', tagName: 'Greater China' },
    ],
  },
  {
    countryCode: 'JP',
    countryNameEn: 'Japan',
    countryNameZh: '日本',
    aliases: ['JP', 'Japan'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'ASIA', tagName: 'Asia' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'APAC', tagName: 'APAC' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'NORTH_ASIA', tagName: 'North Asia' },
    ],
  },
  {
    countryCode: 'AE',
    countryNameEn: 'United Arab Emirates',
    countryNameZh: '阿联酋',
    aliases: ['AE', 'UAE', 'United Arab Emirates'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'ASIA', tagName: 'Asia' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'MIDDLE_EAST', tagName: 'Middle East' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'MENA', tagName: 'MENA' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'GCC', tagName: 'GCC' },
    ],
  },
  {
    countryCode: 'SA',
    countryNameEn: 'Saudi Arabia',
    countryNameZh: '沙特阿拉伯',
    aliases: ['SA', 'Saudi Arabia'],
    tags: [
      { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'ASIA', tagName: 'Asia' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'MIDDLE_EAST', tagName: 'Middle East' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'MENA', tagName: 'MENA' },
      { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'GCC', tagName: 'GCC' },
    ],
  },
];

const COUNTRY_BY_CODE = COUNTRY_DEFINITIONS.reduce((acc, item) => {
  acc.set(item.countryCode, item);
  return acc;
}, new Map<string, CountryDefinition>());

const COUNTRY_ALIAS_TO_CODE = COUNTRY_DEFINITIONS.reduce((acc, item) => {
  item.aliases.forEach((alias) => {
    acc.set(alias.toLowerCase(), item.countryCode);
  });
  acc.set(item.countryNameEn.toLowerCase(), item.countryCode);
  return acc;
}, new Map<string, string>());

const TAG_DEFINITIONS = COUNTRY_DEFINITIONS.flatMap((item) => item.tags)
  .reduce((acc, tag) => {
    const key = `${tag.provider}:${tag.taxonomy}:${tag.tagCode}`;
    if (!acc.has(key)) {
      acc.set(key, tag);
    }
    return acc;
  }, new Map<string, Tag>());

const LEGACY_REGION_TAG_ALIASES: Record<string, any> = {
  europe: { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'EUROPE' },
  asia: { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'ASIA' },
  americas: { taxonomy: 'macro_region', provider: 'GLOBAL', tagCode: 'AMERICAS' },
  latam: { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'LATAM' },
  eea: { taxonomy: 'economic_zone', provider: 'GLOBAL', tagCode: 'EEA' },
  eu: { taxonomy: 'economic_zone', provider: 'GLOBAL', tagCode: 'EU' },
  sepa: { taxonomy: 'payment_zone', provider: 'GLOBAL', tagCode: 'SEPA' },
  apac: { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'APAC' },
  'greater china': { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'GREATER_CHINA' },
  'north america': { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'NORTH_AMERICA' },
  'middle east': { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'MIDDLE_EAST' },
  mena: { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'MENA' },
  gcc: { taxonomy: 'commercial_region', provider: 'GLOBAL', tagCode: 'GCC' },
};

const normalizeString = (value: any = '') => String(value || '')
  .trim()
  .replace(/\s*\([^)]*\)\s*/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getTagKey = (tag: any = {}) => `${tag.provider}:${tag.taxonomy}:${tag.tagCode}`;

const dedupeStrings = (values: string[] = []) => [...new Set(values.filter(Boolean))].sort();

const dedupeTagRefs = (values: any[] = []) => {
  const seen = new Set();
  return values.filter((item) => {
    if (!item) return false;
    const key = getTagKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeCountryCode = (value: any = '') => {
  const normalizedValue = normalizeString(value);
  if (!normalizedValue) {
    return '';
  }

  const directCode = normalizedValue.toUpperCase();
  if (COUNTRY_BY_CODE.has(directCode)) {
    return directCode;
  }

  return COUNTRY_ALIAS_TO_CODE.get(normalizedValue.toLowerCase()) || '';
};

export const getCountryDisplayName = (countryCode: string = '') => (
  COUNTRY_BY_CODE.get(String(countryCode || '').toUpperCase())?.countryNameEn || String(countryCode || '').trim()
);

export const normalizeGeoTagRef = (tag: any) => {
  if (!tag || typeof tag !== 'object') {
    return null;
  }

  const taxonomy = normalizeString(tag.taxonomy);
  const provider = normalizeString(tag.provider || DEFAULT_GEO_PROVIDER).toUpperCase();
  const tagCode = normalizeString(tag.tagCode || tag.code).replace(/\s+/g, '_').toUpperCase();

  if (!taxonomy || !provider || !tagCode) {
    return null;
  }

  const tagKey = `${provider}:${taxonomy}:${tagCode}`;
  const definition = TAG_DEFINITIONS.get(tagKey);

  return {
    taxonomy,
    provider,
    tagCode,
    tagName: definition?.tagName || normalizeString(tag.tagName || tag.label || tagCode),
  };
};

export const normalizeGeoScopeV2 = (scope: any = {}) => {
  const kind = scope?.kind === GEO_SCOPE_KIND_ALL ? GEO_SCOPE_KIND_ALL : GEO_SCOPE_KIND_PARTIAL;
  const countries = dedupeStrings(
    Array.isArray(scope?.countries) ? scope.countries.map((item: any) => normalizeCountryCode(item)) : [],
  );
  const excludeCountries = dedupeStrings(
    Array.isArray(scope?.excludeCountries) ? scope.excludeCountries.map((item: any) => normalizeCountryCode(item)) : [],
  );
  const tags = dedupeTagRefs(
    Array.isArray(scope?.tags) ? scope.tags.map((item: any) => normalizeGeoTagRef(item)).filter(Boolean) : [],
  );
  const excludeTags = dedupeTagRefs(
    Array.isArray(scope?.excludeTags) ? scope.excludeTags.map((item: any) => normalizeGeoTagRef(item)).filter(Boolean) : [],
  );

  return {
    kind,
    countries,
    tags,
    excludeCountries,
    excludeTags,
  };
};

const normalizeLegacySelections = (legacySelections: any[] = []): string[][] => {
  if (!Array.isArray(legacySelections)) {
    return [];
  }

  return legacySelections.reduce((acc, item) => {
    if (item === GEO_SCOPE_GLOBAL_LABEL) {
      acc.push([GEO_SCOPE_GLOBAL_LABEL]);
      return acc;
    }

    if (Array.isArray(item)) {
      const nextItem = item.map((entry) => normalizeString(entry)).filter(Boolean);
      if (nextItem.length > 0) {
        acc.push(nextItem);
      }
      return acc;
    }

    const normalizedItem = normalizeString(item);
    if (normalizedItem) {
      acc.push([normalizedItem]);
    }

    return acc;
  }, [] as string[][]);
};

const selectionToTagRef = (selection: string[] = [], provider = DEFAULT_GEO_PROVIDER) => {
  const leaf = selection[selection.length - 1];
  if (!leaf) {
    return null;
  }

  const aliasRef = LEGACY_REGION_TAG_ALIASES[leaf.toLowerCase()];
  if (!aliasRef) {
    return null;
  }

  const normalizedProvider = aliasRef.provider === 'GLOBAL' ? provider : aliasRef.provider;
  return normalizeGeoTagRef({
    taxonomy: aliasRef.taxonomy,
    provider: normalizedProvider,
    tagCode: aliasRef.tagCode,
  });
};

export const legacyGeoSelectionsToScope = (legacySelections: any[] = [], defaultProvider = DEFAULT_GEO_PROVIDER) => {
  const normalizedSelections = normalizeLegacySelections(legacySelections);
  if (normalizedSelections.some((selection: string[]) => selection.length === 1 && selection[0] === GEO_SCOPE_GLOBAL_LABEL)) {
    return normalizeGeoScopeV2({ kind: GEO_SCOPE_KIND_ALL });
  }

  const countries: string[] = [];
  const tags: any[] = [];

  normalizedSelections.forEach((selection: string[]) => {
    const leaf = selection[selection.length - 1];
    const countryCode = normalizeCountryCode(leaf);
    if (countryCode) {
      countries.push(countryCode);
      return;
    }

    const tagRef = selectionToTagRef(selection, defaultProvider);
    if (tagRef) {
      tags.push(tagRef);
    }
  });

  return normalizeGeoScopeV2({
    kind: GEO_SCOPE_KIND_PARTIAL,
    countries,
    tags,
  });
};

const getCountryTags = (countryCode: string = '', provider = DEFAULT_GEO_PROVIDER) => {
  const definition = COUNTRY_BY_CODE.get(String(countryCode || '').toUpperCase());
  if (!definition) {
    return [];
  }

  return definition.tags
    .filter((tag) => tag.provider === provider)
    .map((tag) => normalizeGeoTagRef(tag))
    .filter(Boolean);
};

export const resolveGeoScopeToCountryCodes = (scope: any = {}, defaultProvider = DEFAULT_GEO_PROVIDER) => {
  const normalizedScope = normalizeGeoScopeV2(scope);
  const countrySet = new Set(
    normalizedScope.kind === GEO_SCOPE_KIND_ALL
      ? COUNTRY_DEFINITIONS.map((item) => item.countryCode)
      : normalizedScope.countries,
  );

  normalizedScope.tags.forEach((tagRef) => {
    COUNTRY_DEFINITIONS.forEach((country) => {
      const matched = country.tags.some((tag) => (
        tag.provider === tagRef.provider
        && tag.taxonomy === tagRef.taxonomy
        && tag.tagCode === tagRef.tagCode
      ));
      if (matched) {
        countrySet.add(country.countryCode);
      }
    });
  });

  normalizedScope.excludeCountries.forEach((countryCode) => {
    countrySet.delete(countryCode);
  });

  normalizedScope.excludeTags.forEach((tagRef) => {
    COUNTRY_DEFINITIONS.forEach((country) => {
      const matched = country.tags.some((tag) => (
        tag.provider === tagRef.provider
        && tag.taxonomy === tagRef.taxonomy
        && tag.tagCode === tagRef.tagCode
      ));
      if (matched) {
        countrySet.delete(country.countryCode);
      }
    });
  });

  const resolved = [...countrySet].sort();
  if (resolved.length > 0) {
    return resolved;
  }

  if (normalizedScope.kind === GEO_SCOPE_KIND_ALL && defaultProvider === DEFAULT_GEO_PROVIDER) {
    return COUNTRY_DEFINITIONS.map((item) => item.countryCode).sort();
  }

  return resolved;
};

export const buildGeoScopeCompatibility = ({
  legacySelections = [],
  scope = null,
  defaultProvider = DEFAULT_GEO_PROVIDER,
}: any = {}) => {
  const normalizedScope = scope && typeof scope === 'object' && !Array.isArray(scope)
    ? normalizeGeoScopeV2(scope)
    : legacyGeoSelectionsToScope(legacySelections, defaultProvider);
  const resolvedCountries = resolveGeoScopeToCountryCodes(normalizedScope, defaultProvider);
  const explicitTags = normalizedScope.tags;
  const derivedTags = dedupeTagRefs(resolvedCountries.flatMap((countryCode) => getCountryTags(countryCode, defaultProvider)));

  return {
    scope: normalizedScope,
    resolvedCountries,
    explicitTags,
    derivedTags,
  };
};

export const getGeoScopeDisplayLabels = (scope: any = {}, defaultProvider = DEFAULT_GEO_PROVIDER) => {
  const { scope: normalizedScope, resolvedCountries } = buildGeoScopeCompatibility({ scope, defaultProvider });
  if (normalizedScope.kind === GEO_SCOPE_KIND_ALL) {
    return [GEO_SCOPE_GLOBAL_LABEL];
  }

  if (normalizedScope.countries.length > 0) {
    return normalizedScope.countries.map((countryCode) => getCountryDisplayName(countryCode));
  }

  if (normalizedScope.tags.length > 0) {
    return normalizedScope.tags.map((tagRef: any) => tagRef.tagName || tagRef.tagCode);
  }

  return resolvedCountries.map((countryCode) => getCountryDisplayName(countryCode));
};

export const buildCountryFilterToken = (countryCode: string = '') => `country:${String(countryCode || '').toUpperCase()}`;

export const buildTagFilterToken = (tagRef: any = {}) => (
  `tag:${tagRef.provider}:${tagRef.taxonomy}:${tagRef.tagCode}`
);

export const buildGeoFilterTokensFromScope = (scope: any = {}, defaultProvider = DEFAULT_GEO_PROVIDER) => {
  const { scope: normalizedScope, resolvedCountries, derivedTags } = buildGeoScopeCompatibility({ scope, defaultProvider });
  const countryTokens = resolvedCountries.map((countryCode) => buildCountryFilterToken(countryCode));
  const tagTokens = dedupeTagRefs([...normalizedScope.tags, ...derivedTags]).map((tagRef) => buildTagFilterToken(tagRef));
  return [...new Set([...countryTokens, ...tagTokens])];
};

export const getGeoFilterTokenLabel = (token: string = '') => {
  if (typeof token !== 'string') {
    return '';
  }

  if (token.startsWith('country:')) {
    const [, countryCode] = token.split(':');
    return getCountryDisplayName(countryCode);
  }

  if (token.startsWith('tag:')) {
    const [, provider, taxonomy, tagCode] = token.split(':');
    const definition = TAG_DEFINITIONS.get(`${provider}:${taxonomy}:${tagCode}`);
    const tagLabel = definition?.tagName || tagCode;
    return provider === DEFAULT_GEO_PROVIDER ? tagLabel : `${tagLabel} (${provider})`;
  }

  return token;
};

export const buildGeoFilterOptionsFromScopes = (scopes: any[] = [], defaultProvider = DEFAULT_GEO_PROVIDER) => {
  const tokens = [...new Set(scopes.flatMap((scope) => buildGeoFilterTokensFromScope(scope, defaultProvider)))];
  return tokens
    .map((value) => ({
      value,
      label: getGeoFilterTokenLabel(value),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
};

export const matchesAnyGeoFilterToken = (scope: any = {}, selectedTokens: string[] = [], defaultProvider = DEFAULT_GEO_PROVIDER) => {
  if (!Array.isArray(selectedTokens) || selectedTokens.length === 0) {
    return true;
  }

  const scopeTokens = buildGeoFilterTokensFromScope(scope, defaultProvider);
  return selectedTokens.some((token) => scopeTokens.includes(token));
};
