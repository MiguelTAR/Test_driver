// US08: state machine for a driving session(inactive->active->paused<->active->inactive)
export type SessionStatus = 'inactive' | 'active' | 'paused';
export type SessionAction = 'start' | 'pause' | 'resume' | 'end';

const TRANSITIONS: Record<SessionStatus, Partial<Record<SessionAction, SessionStatus>>> = {
    inactive: {start: 'inactive'},
    active: {pause: 'paused', end: 'inactive'},
    paused: {resume: 'active', end: 'inactive'},
}; 

/**Returns the next status. An action that is not allowed in the current status is ignored */
export function sessionReducer (status: SessionStatus, action: SessionAction): SessionStatus{
    return TRANSITIONS[status][action] ?? status;
}
/** Data should only be collected while the session is active (not paused). */
export function isCollecting(status: SessionStatus) : boolean {
    return status === 'active';
}
export const SESSION_LABELS: Record<SessionStatus, string> = {
    inactive: 'Inactive',
    active: 'Active',
    paused: 'Paused',
};