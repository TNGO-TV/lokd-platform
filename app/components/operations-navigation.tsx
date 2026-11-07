'use client';
import Link from 'next/link';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
const links = [['/ops','Overview'],['/ops/dispatch','Dispatch'],['/ops/contracts','Contracts'],['/ops/intake','Officer applications'],['/ops/training','Training'],['/ops/readiness','Identity checks'],['/ops/psira','PSiRA checks'],['/ops/agreements','Quotes'],['/ops/service','Shifts and payroll'],['/ops/specialist','Specialist services'],['/ops/finance','Payments due'],['/ops/audit','Audit log'],['/ops/security','Account security']];
export default function OperationsNavigation() {
 const pathname=usePathname();
 return <aside className="operations-sidebar"><Link className="operations-brand" href="/ops" aria-label="LOKD Operations home"><Image unoptimized priority src="/lokd-logo-reverse.svg" alt="LOKD Security" width={148} height={48}/></Link><nav aria-label="Operations">{links.map(([href,label])=><Link key={href} href={href} aria-current={pathname===href?'page':undefined}>{label}</Link>)}</nav><Link href="/ops/intake?kind=client">Client enquiries</Link></aside>;
}
