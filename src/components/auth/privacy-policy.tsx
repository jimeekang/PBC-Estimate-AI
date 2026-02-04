import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function PrivacyPolicy() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="p-0 h-auto text-xs">Learn more</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Privacy Policy</DialogTitle>
        </DialogHeader>
        <div className="prose max-h-[60vh] overflow-y-auto">
          <p><strong>Last Updated: 2024-07-30</strong></p>

          <h4>1. Introduction</h4>
          <p>This Privacy Policy explains how we collect, use, store, and disclose personal information when you use our Painting Estimate Web Application (“the App”, “we”, “us”, or “our”).</p>
          <p>We are committed to protecting your privacy and handling your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).</p>

          <h4>2. Personal Information We Collect</h4>
          <p>We may collect the following types of personal information:</p>
          <ul>
            <li>Name</li>
            <li>Email address</li>
            <li>Contact details</li>
            <li>Location or suburb information</li>
            <li>Painting estimate details (e.g. selected options, property type, size)</li>
            <li>Uploaded photos related to painting estimates</li>
            <li>Account and login information</li>
            <li>Technical data such as IP address, browser type, and usage logs</li>
          </ul>
          <p>We only collect personal information that is reasonably necessary for providing our services.</p>

          <h4>3. How We Collect Personal Information</h4>
          <p>We collect personal information when you:</p>
          <ul>
            <li>Create an account using email authentication</li>
            <li>Log in via an email link</li>
            <li>Submit a painting estimate request</li>
            <li>Upload photos or provide additional project details</li>
            <li>Contact us directly</li>
          </ul>
          <p>Some technical information may be collected automatically when you use the App.</p>

          <h4>4. Purpose of Collection</h4>
          <p>We collect and use your personal information for the following purposes:</p>
          <ul>
            <li>To create and manage user accounts</li>
            <li>To generate AI-based painting cost estimates</li>
            <li>To communicate with users regarding estimates or services</li>
            <li>To improve and optimise our App and services</li>
            <li>To maintain security and prevent misuse</li>
            <li>To comply with legal and regulatory obligations</li>
          </ul>

          <h4>5. Use of Artificial Intelligence</h4>
          <p>Our App uses artificial intelligence to generate estimated price ranges based on the information you provide.</p>
          <ul>
            <li>AI-generated estimates are indicative only</li>
            <li>Personal information is processed only to provide the estimate</li>
            <li>We do not use your personal information to train public AI models</li>
          </ul>

          <h4>6. Disclosure of Personal Information</h4>
          <p>We may disclose personal information to third parties where necessary to provide our services, including:</p>
          <ul>
            <li>Cloud service providers (e.g. Firebase / Google Cloud)</li>
            <li>AI service providers used for estimate generation</li>
            <li>Email and notification service providers</li>
            <li>Professional advisers where required by law</li>
          </ul>
          <p>We do not sell or rent personal information to third parties.</p>

          <h4>7. Overseas Disclosure</h4>
          <p>Your personal information may be stored or processed outside Australia, including on servers operated by third-party service providers.</p>
          <p>We take reasonable steps to ensure that overseas recipients handle personal information in a manner consistent with Australian privacy laws.</p>
          
          <h4>8. Data Security</h4>
          <p>We take reasonable steps to protect personal information from misuse, loss, unauthorised access, modification, or disclosure, including:</p>
          <ul>
            <li>Secure authentication systems</li>
            <li>Encrypted data transmission</li>
            <li>Restricted access controls</li>
            <li>Firebase security rules and monitoring</li>
          </ul>
          <p>However, no method of transmission or storage is completely secure, and we cannot guarantee absolute security.</p>

          <h4>9. Access and Correction</h4>
          <p>You have the right to:</p>
          <ul>
            <li>Request access to personal information we hold about you</li>
            <li>Request correction of inaccurate, outdated, or incomplete information</li>
          </ul>
          <p>Requests can be made by contacting us using the details below.</p>

          <h4>10. Data Retention</h4>
          <p>We retain personal information only for as long as necessary to fulfil the purposes outlined in this policy, unless a longer retention period is required by law.</p>
          <p>You may request deletion of your account and associated personal information at any time.</p>

          <h4>11. Cookies and Analytics</h4>
          <p>We may use cookies or similar technologies to:</p>
          <ul>
            <li>Improve user experience</li>
            <li>Analyse app usage and performance</li>
            <li>Maintain security</li>
          </ul>
          <p>You can control cookies through your browser settings.</p>

          <h4>12. Changes to This Privacy Policy</h4>
          <p>We may update this Privacy Policy from time to time.</p>
          <p>The latest version will always be available within the App or on our website.</p>

          <h4>13. Contact Us</h4>
          <p>If you have any questions, concerns, or complaints about this Privacy Policy or how your personal information is handled, please contact us:</p>
          <ul>
            <li>Email: info@paintbuddyco.com.au</li>
            <li>Business Name: Paint Buddy & Co Pty Ltd</li>
            <li>Location: Australia</li>
          </ul>
          <p>If you are not satisfied with our response, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC).</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
