'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { GitBranchIcon, XIcon, LinkIcon } from '@phosphor-icons/react';

export default function RepositoryPicker({ ticketId, currentRepos = [], repositories = [], onUpdate, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedIds = new Set(currentRepos.map((repo) => repo.id));

  const filteredRepos = useMemo(() => {
    const q = search.toLowerCase();
    return repositories.filter((repo) =>
      `${repo.owner}/${repo.name}`.toLowerCase().includes(q)
    );
  }, [repositories, search]);

  const toggleRepo = (repo) => {
    if (selectedIds.has(repo.id)) {
      const nextRepos = currentRepos.filter((r) => r.id !== repo.id);
      if (ticketId) {
        onUpdate?.(nextRepos.map(r => r.id));
      } else {
        onChange?.(nextRepos);
      }
    } else {
      const nextRepos = [...currentRepos, repo];
      if (ticketId) {
        onUpdate?.(nextRepos.map(r => r.id));
      } else {
        onChange?.(nextRepos);
      }
    }
  };

  return (
    <div className="label-picker">
      <div className="label-list" style={{ minHeight: 'unset', marginBottom: currentRepos.length ? '0.25rem' : '0' }}>
        {currentRepos.map((repo) => (
          <Badge key={repo.id} className="label" style={{ '--label-color': '#4a5568', background: '#3182ce' }} variant="outline">
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <GitBranchIcon weight="bold" />
              {repo.owner}/{repo.name}
            </span>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              onClick={() => toggleRepo(repo)}
              aria-label={`Remove ${repo.owner}/${repo.name}`}
            >
              <XIcon weight="bold" />
            </Button>
          </Badge>
        ))}
      </div>
      
      {currentRepos.map((repo) => (
        <a
          key={`link-${repo.id}`}
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="ticket-external-link"
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', marginTop: '-2px', marginBottom: '4px' }}
        >
          <LinkIcon weight="bold" />
          Open {repo.owner}/{repo.name}
        </a>
      ))}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="label-picker-trigger"
        onClick={() => setOpen((value) => !value)}
        style={{ marginTop: '0.25rem' }}
      >
        <GitBranchIcon weight="bold" />
        {open ? 'Close repositories' : 'Link repository'}
      </Button>

      {open && (
        <div className="label-picker-dropdown">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories"
          />
          <div className="label-picker-options">
            {filteredRepos.map((repo) => {
              const selected = selectedIds.has(repo.id);
              return (
                <div key={repo.id} className="label-picker-row">
                  <button
                    type="button"
                    className="label-picker-item"
                    onClick={() => toggleRepo(repo)}
                  >
                    <Checkbox checked={selected} aria-hidden="true" tabIndex={-1} />
                    <span style={{ fontSize: '0.8125rem' }}>{repo.owner}/{repo.name}</span>
                  </button>
                </div>
              );
            })}
            {!filteredRepos.length && <div className="ticket-detail-empty">No matching repositories.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
