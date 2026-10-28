'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { HStack, VStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Selector } from '@astryxdesign/core/Selector';
import { Card } from '@astryxdesign/core/Card';
import { GitBranch as GitBranchIcon, Sparkle as SparkleIcon } from '@phosphor-icons/react';
import { apiFetch } from '@/lib/client-api';

export default function TicketPullRequestsSection({
  ticketId,
  ticketNumber,
  ticketRepositories = [],
  allRepositories = [],
  onChanged,
}) {
  const [linkedPrs, setLinkedPrs] = useState([]);
  const [detectedPrs, setDetectedPrs] = useState([]);
  const [recentPrs, setRecentPrs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Manual link form state
  const [showManualLink, setShowManualLink] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [prNumberInput, setPrNumberInput] = useState('');
  const [prTitleInput, setPrTitleInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const fetchPrData = useCallback(async () => {
    if (!ticketId) return;
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/prs`);
      if (res.ok) {
        const data = await res.json();
        setLinkedPrs(data.prs || []);
        setDetectedPrs(data.detected_prs || []);
        setRecentPrs(data.recent_prs || []);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchPrData();
  }, [fetchPrData]);

  // Set default repo id for manual linking
  useEffect(() => {
    if (!selectedRepoId) {
      if (ticketRepositories.length > 0) {
        setSelectedRepoId(ticketRepositories[0].id);
      } else if (allRepositories.length > 0) {
        setSelectedRepoId(allRepositories[0].id);
      }
    }
  }, [ticketRepositories, allRepositories, selectedRepoId]);

  const handleLinkPr = async (repoId, prNumber, title = '') => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/prs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_id: repoId,
          pr_number: prNumber,
          title: title || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || 'Failed to link pull request.');
        return;
      }

      setPrNumberInput('');
      setPrTitleInput('');
      setShowManualLink(false);
      await fetchPrData();
      onChanged?.();
    } catch {
      setErrorMessage('Network error while linking pull request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkPr = async (repoId, prNumber) => {
    try {
      const res = await apiFetch(`/api/tickets/${ticketId}/prs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_id: repoId, pr_number: prNumber }),
      });
      if (res.ok) {
        await fetchPrData();
        onChanged?.();
      }
    } catch {}
  };

  const repoOptions = (ticketRepositories.length > 0 ? ticketRepositories : allRepositories).map((r) => ({
    value: r.id,
    label: `${r.owner}/${r.name}`,
  }));

  return (
    <Card p={3} variant="subtle">
      <VStack gap={3}>
        {/* Header */}
        <HStack gap={2} vAlign="center" justify="space-between">
          <HStack gap={1} vAlign="center">
            <GitBranchIcon size={16} weight="bold" />
            <Text size="xs" weight="bold" color="secondary">
              PULL REQUESTS ({linkedPrs.length})
            </Text>
          </HStack>
          <Button
            variant="ghost"
            size="sm"
            label={showManualLink ? 'Cancel' : '+ Link PR'}
            onClick={() => setShowManualLink((v) => !v)}
          />
        </HStack>

        {errorMessage && (
          <HStack p={2} justify="space-between" vAlign="center" style={{ backgroundColor: 'var(--color-status-error-subtle, rgba(239,68,68,0.1))' }}>
            <Text size="xs" color="error">{errorMessage}</Text>
            <Button variant="ghost" size="sm" label="Dismiss" onClick={() => setErrorMessage(null)} />
          </HStack>
        )}

        {/* Auto-detected PRs Banner */}
        {detectedPrs.length > 0 && (
          <Card p={3} variant="standard" style={{ borderLeft: '3px solid var(--color-status-accent, #3b82f6)' }}>
            <VStack gap={2}>
              <HStack gap={1} vAlign="center">
                <SparkleIcon size={14} weight="bold" style={{ color: 'var(--color-status-accent, #3b82f6)' }} />
                <Text size="xs" weight="bold" color="accent">
                  Auto-detected PRs mentioning Ticket #{ticketNumber} ({detectedPrs.length})
                </Text>
              </HStack>

              <VStack gap={1}>
                {detectedPrs.map((dpr) => (
                  <HStack key={`${dpr.repo_id}:${dpr.number}`} gap={2} vAlign="center" justify="space-between">
                    <HStack gap={1} vAlign="center" wrap="nowrap" style={{ overflow: 'hidden' }}>
                      <Badge variant={dpr.state === 'open' ? 'success' : 'neutral'} size="sm">
                        #{dpr.number}
                      </Badge>
                      <Text size="xs" weight="semibold" maxLines={1}>
                        {dpr.title}
                      </Text>
                      <Text size="xs" color="secondary">
                        ({dpr.repo_owner}/{dpr.repo_name})
                      </Text>
                    </HStack>
                    <Button
                      variant="primary"
                      size="sm"
                      label="+ Link"
                      onClick={() => handleLinkPr(dpr.repo_id, dpr.number, dpr.title)}
                    />
                  </HStack>
                ))}
              </VStack>
            </VStack>
          </Card>
        )}

        {/* Manual Link Form */}
        {showManualLink && (
          <Card p={3} variant="standard">
            <VStack gap={2}>
              <Text size="xs" weight="bold">Link specific Pull Request</Text>

              <HStack gap={2} vAlign="center" wrap="wrap">
                {repoOptions.length > 0 && (
                  <Selector
                    label="Repository"
                    isLabelHidden
                    value={selectedRepoId || repoOptions[0]?.value}
                    onChange={setSelectedRepoId}
                    options={repoOptions}
                    size="sm"
                  />
                )}
                <TextInput
                  label="PR #"
                  isLabelHidden
                  placeholder="PR # (e.g. 14)"
                  type="number"
                  value={prNumberInput}
                  onChange={setPrNumberInput}
                  size="sm"
                  style={{ width: 110 }}
                />
                <TextInput
                  label="Title (optional)"
                  isLabelHidden
                  placeholder="PR title (optional)"
                  value={prTitleInput}
                  onChange={setPrTitleInput}
                  size="sm"
                  style={{ flex: 1, minWidth: 140 }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  label="Link"
                  isDisabled={!prNumberInput}
                  isLoading={isSubmitting}
                  onClick={() => handleLinkPr(selectedRepoId || repoOptions[0]?.value, parseInt(prNumberInput, 10), prTitleInput)}
                />
              </HStack>

              {/* Suggestions from recent unlinked PRs across connected repos */}
              {recentPrs.length > 0 && (
                <VStack gap={1} mt={1}>
                  <Text size="xs" color="secondary" weight="bold">Recent pull requests:</Text>
                  <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                    <VStack gap={1}>
                      {recentPrs.map((rpr) => (
                        <HStack
                          key={`${rpr.repo_id}:${rpr.number}`}
                          gap={2}
                          vAlign="center"
                          justify="space-between"
                          p={1}
                          style={{
                            borderBottom: '1px solid var(--color-border-subtle, rgba(0,0,0,0.04))',
                          }}
                        >
                          <HStack gap={1} vAlign="center" wrap="nowrap" style={{ overflow: 'hidden' }}>
                            <Badge variant={rpr.state === 'open' ? 'success' : 'neutral'} size="sm">
                              #{rpr.number}
                            </Badge>
                            <Text size="xs" maxLines={1}>{rpr.title}</Text>
                            <Text size="xs" color="secondary">
                              ({rpr.repo_owner}/{rpr.repo_name})
                            </Text>
                          </HStack>
                          <Button
                            variant="secondary"
                            size="sm"
                            label="+ Link"
                            onClick={() => handleLinkPr(rpr.repo_id, rpr.number, rpr.title)}
                          />
                        </HStack>
                      ))}
                    </VStack>
                  </div>
                </VStack>
              )}
            </VStack>
          </Card>
        )}

        {/* Linked PRs List */}
        <VStack gap={1}>
          {linkedPrs.map((pr) => (
            <Card key={`${pr.repo_id}:${pr.number}`} p={2} variant="standard">
              <HStack gap={2} vAlign="center" justify="space-between">
                <HStack gap={2} vAlign="center" wrap="nowrap" style={{ overflow: 'hidden' }}>
                  <Badge variant={pr.state === 'open' ? 'success' : pr.state === 'merged' ? 'accent' : 'neutral'} size="sm">
                    #{pr.number}
                  </Badge>
                  <Text size="xs" weight="semibold" maxLines={1}>
                    {pr.title}
                  </Text>
                  <Text size="xs" color="secondary">
                    {pr.repo_owner}/{pr.repo_name}
                  </Text>
                </HStack>
                <HStack gap={1} vAlign="center">
                  {pr.html_url && (
                    <a href={pr.html_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                      <Button variant="ghost" size="sm" label="GitHub ↗" />
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    label="✕"
                    onClick={() => handleUnlinkPr(pr.repo_id, pr.number)}
                  />
                </HStack>
              </HStack>
            </Card>
          ))}
          {linkedPrs.length === 0 && !isLoading && (
            <Text size="xs" color="secondary">No pull requests linked yet.</Text>
          )}
        </VStack>
      </VStack>
    </Card>
  );
}
