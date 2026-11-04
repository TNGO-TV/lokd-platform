import { OfficerApplicationJourney } from "../join/page";
import { publicMetadata } from "../lib/public-site";
export const metadata = publicMetadata("Officer signup", "Start your LOKD officer application. Add your contact details, registration and work interests, then track your next steps in your account.", "/signup");
export default function SignupPage() { return <OfficerApplicationJourney />; }
