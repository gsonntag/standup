'use client';

import { Label } from '@/components/ui/label';

export function AppField({ id, label, icon: Icon, help, actions, children, className = '' }) {
  return (
    <div className={`app-field${className ? ` ${className}` : ''}`}>
      {(label || help || actions) && (
        <div className="app-field-header">
          <div className="app-field-copy">
            {label && (
              <Label htmlFor={id} className="app-field-label">
                {Icon && <Icon weight="bold" />}
                {label}
              </Label>
            )}
            {help && <p className="app-field-help">{help}</p>}
          </div>
          {actions && <div className="app-field-actions">{actions}</div>}
        </div>
      )}
      <div className="app-field-control">{children}</div>
    </div>
  );
}

export function AppActions({ children, className = '', align = 'end' }) {
  return (
    <div className={`app-actions app-actions-${align}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}

export function AppEmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={`app-empty-state${className ? ` ${className}` : ''}`}>
      {Icon && (
        <span className="app-empty-icon" aria-hidden="true">
          <Icon weight="bold" />
        </span>
      )}
      <div className="app-empty-copy">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      {action}
    </div>
  );
}
