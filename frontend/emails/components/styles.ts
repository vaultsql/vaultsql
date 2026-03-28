/**
 * Shared styles for email templates
 */

export const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

export const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '560px',
};

export const brand = {
  color: '#333',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 32px 0',
  padding: '0 40px',
  textAlign: 'left' as const,
};

export const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0 0 24px 0',
  padding: '0 40px',
  textAlign: 'left' as const,
};

export const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  textAlign: 'left' as const,
  padding: '0 40px',
  marginBottom: '16px',
};

export const buttonContainer = {
  textAlign: 'left' as const,
  margin: '32px 0',
  padding: '0 40px',
};

export const button = {
  backgroundColor: '#0070f3',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
};

export const footer = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '24px',
  marginTop: '32px',
  textAlign: 'left' as const,
  padding: '0 40px',
};

export const codeContainer = {
  background: '#f4f4f4',
  borderRadius: '8px',
  margin: '32px 40px',
  padding: '24px',
  textAlign: 'center' as const,
  width: 'fit-content',
  border: '2px solid #e5e5e5',
};

export const codeText = {
  color: '#000',
  fontSize: '36px',
  fontWeight: 'bold',
  letterSpacing: '12px',
  lineHeight: '44px',
  margin: '0',
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
};
