// Security utilities for input validation and sanitization

// File upload security constants
export const ALLOWED_FILE_TYPES = {
  documents: [
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/csv',
    'application/json'
  ],
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILENAME_LENGTH = 255;

// File validation utilities
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

export function validateFileSize(file: File, maxSize: number = MAX_FILE_SIZE): boolean {
  return file.size <= maxSize;
}

export function validateFileName(fileName: string): boolean {
  // Check length
  if (fileName.length > MAX_FILENAME_LENGTH) return false;
  
  // Check for dangerous characters (excluding control characters for security)
  const dangerousChars = /[<>:"/\\|?*]/;
  // eslint-disable-next-line no-control-regex
  const controlChars = /[\x00-\x1f]/;
  if (dangerousChars.test(fileName) || controlChars.test(fileName)) return false;
  
  // Check for reserved names (Windows)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (reservedNames.test(fileName)) return false;
  
  return true;
}

// Text input sanitization
export function sanitizeTextInput(input: string): string {
  if (!input) return '';
  
  return input
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 10000); // Limit length
}

// AI prompt sanitization to prevent injection
export function sanitizeAIPrompt(prompt: string): string {
  if (!prompt) return '';
  
  // Remove potential instruction injection attempts
  const dangerousPatterns = [
    /ignore\s+previous\s+instructions/gi,
    /forget\s+everything/gi,
    /new\s+instructions/gi,
    /system\s*:/gi,
    /assistant\s*:/gi,
    /human\s*:/gi,
    /<\s*script/gi,
    /javascript\s*:/gi,
    /data\s*:/gi
  ];
  
  let sanitized = prompt;
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  });
  
  return sanitizeTextInput(sanitized);
}

// Email validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email) && email.length <= 320;
}

// URL validation
export function validateURL(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

// DOI validation
export function validateDOI(doi: string): boolean {
  const doiRegex = /^10\.\d{4,}\/[-._;()/:a-zA-Z0-9]+$/;
  return doiRegex.test(doi);
}

// Comprehensive file validation
export function validateFile(file: File, type: 'documents' | 'images' = 'documents') {
  const errors: string[] = [];
  
  if (!validateFileName(file.name)) {
    errors.push('Invalid file name. Avoid special characters and use a shorter name.');
  }
  
  if (!validateFileType(file, ALLOWED_FILE_TYPES[type])) {
    errors.push(`File type not allowed. Allowed types: ${ALLOWED_FILE_TYPES[type].join(', ')}`);
  }
  
  if (!validateFileSize(file)) {
    errors.push(`File size too large. Maximum size is ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}