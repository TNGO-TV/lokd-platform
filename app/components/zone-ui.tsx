import Image from 'next/image';
import type { ReactNode } from 'react';

export type ZoneIconName = 'home' | 'calendar' | 'report' | 'user' | 'shield' | 'qr' | 'car' | 'people' | 'route' | 'clock' | 'bell' | 'chevron' | 'briefcase' | 'alert' | 'camera' | 'check';
export function ZoneIcon({ name, tone, className = '' }: { name: ZoneIconName; tone?: 'blue' | 'red'; className?: string }) {
  const size = name === 'chevron' ? 16 : ['clock', 'bell', 'briefcase', 'alert', 'camera', 'check'].includes(name) ? 22 : 24;
  const icon = <Image unoptimized src={'/zone/' + name + '.svg'} alt="" width={size} height={size} aria-hidden="true" />;
  return tone ? <span className={'zone-icon-box zone-icon-' + tone + ' ' + className}>{icon}</span> : <span className={'zone-icon ' + className}>{icon}</span>;
}
export function ZoneHeading({ title, detail, icon = 'shield' }: { title: string; detail?: string; icon?: ZoneIconName }) {
  return <header className="zone-heading"><div><ZoneIcon name={icon} tone="blue" /><h1>{title}</h1></div>{detail && <p>{detail}</p>}</header>;
}
export function ZoneNotice({ title, children, urgent = false }: { title: string; children: ReactNode; urgent?: boolean }) {
  return <aside className={'zone-notice' + (urgent ? ' zone-notice-urgent' : '')}><ZoneIcon name={urgent ? 'alert' : 'shield'} tone={urgent ? 'red' : 'blue'} /><div><strong>{title}</strong><div>{children}</div></div></aside>;
}
export function ZoneProgress({ step, labels = ['Service', 'Details', 'Confirm'] }: { step: number; labels?: string[] }) {
  return <ol className="zone-progress" aria-label="Progress">{labels.map((label, index) => <li key={label} aria-current={index + 1 === step ? 'step' : undefined} className={index < step ? 'zone-progress-complete' : undefined}><span>{index + 1}</span> {label}</li>)}</ol>;
}
export function InitialsAvatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  return <span className="zone-avatar" aria-hidden="true">{initials}</span>;
}
export function ZoneTimeline({ items }: { items: { title: string; detail: string; state: 'done' | 'current' | 'pending' }[] }) {
  return <ol className="zone-timeline">{items.map(item => <li key={item.title} data-state={item.state}><ZoneIcon name={item.state === 'current' ? 'clock' : item.state === 'done' ? 'shield' : 'calendar'} tone="blue" /><div><strong>{item.title}</strong><p>{item.detail}</p></div></li>)}</ol>;
}
