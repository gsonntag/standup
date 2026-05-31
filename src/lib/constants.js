export const TICKET_TEMPLATE = `## Summary
<!-- Brief description of what needs to be done -->

## Acceptance Criteria
- [ ] ...

## Notes
<!-- Any additional context, links, or references -->`;

export const STATUSES = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'PR' },
  { value: 'done', label: 'Prod' },
];

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const SPRINT_STATUSES = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

export const LABEL_COLORS = [
  { hex: '#e53e3e', name: 'Red' },
  { hex: '#dd6b20', name: 'Orange' },
  { hex: '#d69e2e', name: 'Yellow' },
  { hex: '#38a169', name: 'Green' },
  { hex: '#319795', name: 'Teal' },
  { hex: '#3182ce', name: 'Blue' },
  { hex: '#5a67d8', name: 'Indigo' },
  { hex: '#805ad5', name: 'Purple' },
  { hex: '#d53f8c', name: 'Pink' },
  { hex: '#718096', name: 'Gray' },
  { hex: '#2d3748', name: 'Dark Gray' },
  { hex: '#e2e8f0', name: 'Light Gray' },
  { hex: '#c05621', name: 'Brown' },
  { hex: '#2b6cb0', name: 'Dark Blue' },
  { hex: '#276749', name: 'Dark Green' },
  { hex: '#9b2c2c', name: 'Dark Red' },
];

export const ROLES = {
  MEMBER: 'member',
  ADMIN: 'admin',
};

export const SESSION_DURATION_DAYS = 7;
export const MAX_USERNAME_LENGTH = 8;
export const MIN_PASSWORD_LENGTH = 4;
export const TEMP_PASSWORD_LENGTH = 8;
