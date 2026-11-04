import {requireLokdUser} from '../lokd-auth';
import OfficerApp from '../components/officer-app';
export const dynamic='force-dynamic';
export default async function OfficerPage(){await requireLokdUser('/officer');return <OfficerApp/>;}
