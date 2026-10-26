import { useEffect, useRef } from 'react';
import { Icon } from './shared';

export default function DesktopWindow({ id, title, record, active, onFocus, onClose, onMinimize, onMove, onMaximize, children }) {
  const drag = useRef(null);
  const windowRef = useRef(null);
  useEffect(() => { if (active) windowRef.current?.focus({ preventScroll: true }); }, [active]);
  const move = (x, y) => onMove(id, { x: Math.max(0, Math.min(x, Math.max(0, innerWidth - Math.min(record.width, innerWidth)))), y: Math.max(166, Math.min(y, Math.max(166, innerHeight - Math.min(record.height, innerHeight - 260) - 95))) });
  const startDrag = event => {
    if (event.button !== 0 || event.target.closest('button') || innerWidth < 768 || record.maximized) return;
    onFocus(id); drag.current = { x: event.clientX, y: event.clientY, left: record.x, top: record.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const keyboardMove = event => {
    if (event.target !== event.currentTarget) return;
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (directions[event.key]) {
      event.preventDefault(); const [x, y] = directions[event.key]; const step = event.shiftKey ? 40 : 10;
      move(record.x + x * step, record.y + y * step);
    }
    if (event.key === 'Escape') onClose(id);
  };
  if (record.minimized) return null;
  return <section ref={windowRef} tabIndex={-1} role="region" aria-labelledby={`window-${id}`} className={`desktop-window ${active ? 'window-active' : ''} ${record.maximized ? 'window-maximized' : ''}`} style={{ left: record.x, top: record.y, width: record.width, height: record.height, zIndex: record.z }} onPointerDownCapture={() => onFocus(id)} onFocusCapture={() => onFocus(id)}>
    <header className="window-titlebar" tabIndex={0} aria-label={`${title} title bar. Use arrow keys to move; Escape to close.`} onKeyDown={keyboardMove} onPointerDown={startDrag} onPointerMove={event => {
      if (drag.current) move(drag.current.left + event.clientX - drag.current.x, drag.current.top + event.clientY - drag.current.y);
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <div className="traffic-lights"><button className="traffic-close" aria-label={`Close ${title}`} onClick={() => onClose(id)}><Icon name="close" size={10}/></button><button className="traffic-minimize" aria-label={`Minimize ${title}`} onClick={() => onMinimize(id)}><span>−</span></button><button className="traffic-maximize" aria-label={`Resize ${title}`} onClick={() => onMaximize(id)}><span>+</span></button></div>
      <h2 id={`window-${id}`}>{title}</h2><span className="window-title-mark" aria-hidden="true"><Icon name="library" size={14}/></span>
    </header>
    <div className="window-body">{children}</div>
  </section>;
}
