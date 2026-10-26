import { useEffect, useRef, useState } from 'react';
import { Icon } from './shared';

const steps = [
  { icon: 'connect', title: 'Start with a connection.', text: 'Use Personal connector to save new messages from your WhatsApp Message Yourself chat. The Connect window behind this tour has installation and pairing instructions.' },
  { icon: 'library', title: 'Your saved things, organised.', text: 'Click a folder to open All items, Links, Upcoming, Photos or Bookmarks. Add a bookmark from any saved card. Sensitive items live in Confidential, behind a password unlock.' },
  { icon: 'search', title: 'Find it in your own words.', text: 'Use the search bar for a topic, then narrow by type or saved date. Ask AI answers from your saved items and shows its sources. Confidential items stay out of AI search.' },
  { icon: 'edit', title: 'Make your library your own.', text: 'Use Edit heading on a card to rename it, change its category or edit its tags. These edits survive reprocessing. Upcoming events appear in Reminders; urgent ones are red.' },
];

export default function WelcomeTour({ onClose }) {
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const current = steps[step];
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="welcome-tour" aria-labelledby="tour-title" aria-describedby="tour-description" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="tour-topline"><span>WELCOME TO ENGRAM</span><button onClick={onClose} aria-label="Close tour"><Icon name="close" size={18}/></button></div>
    <div className={`tour-illustration tour-step-${step}`} aria-hidden="true"><Icon name={current.icon} size={48}/><span>0{step + 1}</span></div>
    <div className="tour-copy" aria-live="polite"><span className="eyebrow">A QUICK LOOK · {step + 1} OF {steps.length}</span><h2 id="tour-title">{current.title}</h2><p id="tour-description">{current.text}</p></div>
    <div className="tour-progress" aria-label="Tour steps">{steps.map((item, index) => <button key={item.title} aria-label={`Step ${index + 1}: ${item.title}`} aria-current={index === step ? 'step' : undefined} onClick={() => setStep(index)}/>)}</div>
    <div className="tour-actions"><button className="tour-skip" onClick={onClose}>Skip tour</button>{step > 0 && <button onClick={() => setStep(value => value - 1)}>Back</button>}<button className="primary" onClick={() => step === steps.length - 1 ? onClose() : setStep(value => value + 1)}>{step === steps.length - 1 ? 'Let’s connect WhatsApp' : 'Next'}<Icon name="arrow" size={16}/></button></div>
    <p className="tour-replay">You can take this tour again from Help.</p>
  </dialog>;
}
