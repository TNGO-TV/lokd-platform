import {createRoot} from 'react-dom/client';
import ClientEnquiryForm from '../../app/components/client-enquiry-form';
import '../../app/globals.css';
import '../../app/styles/booking.css';
createRoot(document.getElementById('root')!).render(<main><h1>Contact LOKD</h1><ClientEnquiryForm/></main>);
