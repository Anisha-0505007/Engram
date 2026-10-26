import { useState } from 'react';
import { Icon } from './shared';

export default function ConnectorSetup() {
  const [setup, setSetup] = useState(false);
  const [opened, setOpened] = useState(false);
  // Vite is a development UI server; the connector talks to Express directly.
  const server = import.meta.env.DEV && location.port === '5173'
    ? `${location.protocol}//${location.hostname}:8000` : location.origin;
  const launchLink = `engram://connect?server=${encodeURIComponent(server)}`;
  return <article className="connection-card">
    <div className="connection-heading"><span className="connection-icon"><Icon name="connect" size={24}/></span><h4>Personal connector</h4><span className="status-pill">Runs on your computer</span></div>
    <p>Save new notes, links, images and PDFs from your own WhatsApp Message Yourself chat.</p>
    <button onClick={() => setSetup(value => !value)} aria-expanded={setup}>{setup ? 'Hide setup' : 'Set up on this computer'}<Icon name="arrow" size={16}/></button>
    {setup && <div className="connector-setup">
      <h5>One-time setup · Windows 10 or later (64-bit)</h5>
      <ol>
        <li><a href="/api/connectors/download/windows">Download the Windows installer</a>, then open <strong>EngramConnectorSetup.exe</strong> from your downloads. It includes everything needed; you do not need Node.js or commands.</li>
        <li>Finish installation, then return here and click <strong>Open connector</strong> below. Allow your browser to open EngramConnector if prompted.</li>
        <li>A terminal window opens automatically. Check that it shows <code>{server}</code>, type <strong>yes</strong>, then enter your Engram email and password. Your password stays hidden as you type.</li>
        <li>Enter your WhatsApp number with country code. On your phone, open WhatsApp → Linked devices → Link a device → Link with phone number. Enter the pairing code shown in the terminal.</li>
        <li>Wait for <strong>WhatsApp connected</strong>, then send a new message to Message Yourself. Keep the terminal open and this computer awake.</li>
      </ol>
      <p className="footnote">Install only a copy supplied by your Engram operator. This prototype installer is unsigned; Windows may show a publisher warning.</p>
    </div>}
    <p><a className="connector-open" href={launchLink} onClick={() => setOpened(true)}>Open connector ↗</a></p>
    {opened && <p className="inline-note" role="status">Look for the connector terminal or your browser’s permission prompt. Nothing opened? Install it using “Set up on this computer”, then try again. This page cannot confirm whether it launched.</p>}
    <p className="footnote">Already installed? Use Open connector each time you want to start saving. Closing the terminal stops capture. Only new messages are captured, not history. This is an unofficial local WhatsApp integration.</p>
    <details><summary>Manual setup / other operating systems</summary><p>Requires Node.js 24 or newer and the connector folder from the Engram project. In that folder run <code>npm install</code>, then <code>npm start</code>. Enter <code>{server}</code> when asked for the server URL, then follow the sign-in and phone-pairing prompts.</p></details>
  </article>;
}
