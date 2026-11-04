import type { Metadata } from 'next';
import OperationsNavigation from '../components/operations-navigation';
export const metadata: Metadata = {title:'LOKD Operations',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}) {
 return <div className="operations-layout"><OperationsNavigation/><div className="operations-content"><header className="operations-topbar">LOKD Security · Operations</header>{children}</div></div>;
}
