import {requireLokdUser} from '../../lokd-auth';
import OfficerApp from '../../components/officer-app';
export const dynamic='force-dynamic';
export default async function Page(){await requireLokdUser('/officer/service');return <OfficerApp initialTab="Work"/>;}
