import OfficerZoneShell from '../components/officer-zone-shell';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Officer Zone',robots:{index:false,follow:false}};
export default function OfficerPortalLayout({children}:{children:React.ReactNode}){return <OfficerZoneShell>{children}</OfficerZoneShell>;}
