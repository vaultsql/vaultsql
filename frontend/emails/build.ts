import { render } from '@react-email/render';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildTemplates() {
  const buildDir = path.join(__dirname, 'build');

  // Ensure build directory exists
  await fs.mkdir(buildDir, { recursive: true });

  // Define templates with their component names and variable mappings
  const templates = [
    { 
      name: 'login-code', 
      component: 'LoginCode',
      props: { code: '{{code}}', email: '{{email}}' }
    },
    { 
      name: 'key-approval-request', 
      component: 'KeyApprovalRequest',
      props: {
        requesterName: '{{requesterName}}',
        requesterEmail: '{{requesterEmail}}',
        workspaceName: '{{workspaceName}}',
        inboxUrl: '{{inboxUrl}}'
      }
    },
    {
      name: 'access-requested',
      component: 'AccessRequested',
      props: {
        requesterName: '{{requesterName}}',
        requesterEmail: '{{requesterEmail}}',
        serverName: '{{serverName}}',
        profileName: '{{profileName}}',
        reason: '{{reason}}',
        grantedUntil: '{{grantedUntil}}',
        inboxUrl: '{{inboxUrl}}'
      }
    },
    {
      name: 'access-approved',
      component: 'AccessApproved',
      props: {
        serverName: '{{serverName}}',
        profileName: '{{profileName}}',
        approvedBy: '{{approvedBy}}',
        approvedAt: '{{approvedAt}}',
        accessUntil: '{{accessUntil}}',
        dashboardUrl: '{{dashboardUrl}}'
      }
    },
    {
      name: 'access-denied',
      component: 'AccessDenied',
      props: {
        serverName: '{{serverName}}',
        profileName: '{{profileName}}',
        deniedBy: '{{deniedBy}}',
        deniedAt: '{{deniedAt}}',
        dashboardUrl: '{{dashboardUrl}}'
      }
    }
  ];

  console.log('Building email templates...\n');

  for (const { name, component, props } of templates) {
    try {
      const templateModule = await import(`./templates/${component}.tsx`);
      const Template = templateModule.default;

      // Render to HTML with template variables
      const html = await render(Template(props));

      // Write to build directory
      const outputPath = path.join(buildDir, `${name}.html`);
      await fs.writeFile(outputPath, html, 'utf-8');

      console.log(`✓ Built ${name}.html`);
    } catch (error) {
      console.error(`✗ Failed to build ${name}:`, error);
      process.exit(1);
    }
  }

  console.log(`\n✓ Successfully built ${templates.length} email template(s)`);
}

buildTemplates().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
