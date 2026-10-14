import {createContext} from 'react';
/** The form owner blocks header/back dismissal while its footer awaits a save. */
export const FormSubmissionContext = createContext<{setPending:(pending:boolean)=>void} | null>(null);
