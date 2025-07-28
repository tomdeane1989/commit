// Version Management System
// Semantic Versioning: MAJOR.MINOR.PATCH
// MAJOR: Breaking changes, major system updates
// MINOR: New features, significant enhancements  
// PATCH: Bug fixes, small style changes

export const VERSION = {
  major: 1,
  minor: 1,
  patch: 0,
  // Pre-release identifiers (optional)
  prerelease: '', // e.g., 'beta.1', 'rc.2', ''
};

export const getVersionString = (): string => {
  const base = `${VERSION.major}.${VERSION.minor}.${VERSION.patch}`;
  return VERSION.prerelease ? `${base}-${VERSION.prerelease}` : base;
};

export const getEnvironment = (): 'development' | 'production' | 'staging' => {
  if (typeof window === 'undefined') return 'development';
  
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  } else if (hostname.includes('staging') || hostname.includes('preview')) {
    return 'staging';
  } else {
    return 'production';
  }
};

export const getVersionInfo = () => {
  const version = getVersionString();
  const environment = getEnvironment();
  const buildDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return {
    version,
    environment,
    buildDate,
    displayText: `v${version} ${environment === 'development' ? '(dev)' : ''}`.trim()
  };
};