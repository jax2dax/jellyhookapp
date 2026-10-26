// hubspot/src/app/cards/JellyhookCard.jsx
// The Jellyhook card on a HubSpot contact record (middle column). Asks Jellyhook (app/api/hubspot/card, signed by
// HubSpot) what this contact did on the website before sending the form: each of their Jellyhook leads with its visit
// summary (Short / Moderate / Long), team marks, the hooks that caught it, where it came from, and "Open visit chart",
// which opens the real chart in a HubSpot modal (app/embed/visit). Laid out with colour-coded tags (green: hooked,
// blue: marks), a tile per lead and a stats row (hooks, marks). Per lead: page, site and form small at the top, then the
// date, the tags, "Came from" as plain text right above the summary. HubSpot cards take only HubSpot's own components (no
// custom CSS), so colour comes from their variants. Design: mds/build/integrations/hubspot.md.
import React, { useEffect, useState } from "react";
import { Button, Divider, EmptyState, ErrorState, Flex, Link, LoadingSpinner, Statistics, StatisticsItem, Tag, Tile, Text, hubspot } from "@hubspot/ui-extensions";

const CARD_URL = "https://jellyhook.com/api/hubspot/card";
const VERSIONS = [
  ["short", "Short"],
  ["moderate", "Moderate"],
  ["long", "Long"],
];

hubspot.extend(({ context, actions }) => <JellyhookCard context={context} actions={actions} />);

/** "3 h ago", "2 days ago" */
const ago = (iso) => {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return Math.round(ms / 60_000) + " min ago";
  if (ms < 86_400_000) return Math.round(ms / 3_600_000) + " h ago";
  return Math.round(ms / 86_400_000) + " days ago";
};
const when = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function JellyhookCard({ context, actions }) {
  const [answer, setAnswer] = useState(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState("moderate");

  const load = () => {
    setFailed(false);
    setAnswer(null);
    hubspot
      .fetch(CARD_URL, { method: "POST", body: { contactId: String(context.crm.objectId) }, timeout: 20000 })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("status " + res.status))))
      .then(setAnswer)
      .catch(() => setFailed(true));
  };
  useEffect(load, [context.crm.objectId]);

  if (failed)
    return (
      <ErrorState title="Jellyhook could not load this contact">
        <Text>Try again in a moment.</Text>
        <Button onClick={load}>Try again</Button>
      </ErrorState>
    );
  if (!answer) return <LoadingSpinner label="Loading Jellyhook" />;
  if (answer.state === "not-connected")
    return (
      <EmptyState title="Jellyhook is not connected to this HubSpot account" layout="vertical">
        <Text>An admin connects it in Jellyhook, under Integrations, HubSpot.</Text>
      </EmptyState>
    );
  if (answer.state === "reconnect")
    return (
      <EmptyState title="Reconnect Jellyhook" layout="vertical">
        <Text>HubSpot stopped accepting Jellyhook's connection. An admin reconnects it in Jellyhook, under Integrations, HubSpot.</Text>
      </EmptyState>
    );
  if (answer.state === "no-email")
    return (
      <EmptyState title="No email on this contact" layout="vertical">
        <Text>Jellyhook finds a contact's visits by the email they sent in your form.</Text>
      </EmptyState>
    );
  if (answer.state === "no-leads")
    return (
      <EmptyState title="No Jellyhook visits for this email" layout="vertical">
        <Text>Nobody sent a form tracked by Jellyhook with {answer.email}.</Text>
      </EmptyState>
    );

  const leads = answer.leads;
  const hookCount = new Set(leads.flatMap((l) => l.hooks)).size;
  const markCount = new Set(leads.flatMap((l) => l.marks)).size;

  return (
    <Flex direction="column" gap="md">
      <Statistics>
        <StatisticsItem id="hooks" label="Hooks that caught them" number={hookCount} />
        <StatisticsItem id="marks" label="Marks" number={markCount} />
      </Statistics>

      <Flex direction="row" gap="extra-small" align="center" wrap="wrap">
        <Text variant="microcopy">Summary</Text>
        {VERSIONS.map(([v, label]) => (
          <Button key={v} size="xs" variant={v === version ? "primary" : "secondary"} onClick={() => setVersion(v)}>
            {label}
          </Button>
        ))}
      </Flex>

      {leads.map((lead) => (
        <Tile key={lead.id}>
          <Flex direction="column" gap="sm">
            <Flex direction="row" justify="between" align="center" wrap="wrap" gap="extra-small">
              <Text variant="microcopy">
                {lead.page ? lead.page + " · " : ""}
                {lead.site}
              </Text>
              {lead.form && <Text variant="microcopy">{lead.form}</Text>}
            </Flex>

            <Flex direction="row" justify="between" align="center" wrap="wrap" gap="extra-small">
              <Text format={{ fontWeight: "bold" }}>Form sent {when(lead.submittedAt)}</Text>
              <Text variant="microcopy">{ago(lead.submittedAt)}</Text>
            </Flex>

            {(lead.hooks.length > 0 || lead.marks.length > 0) && (
              <Flex direction="row" gap="extra-small" wrap="wrap">
                {lead.hooks.map((h) => (
                  <Tag key={"h" + h} variant="success">
                    Hooked: {h}
                  </Tag>
                ))}
                {lead.marks.map((m) => (
                  <Tag key={"m" + m} variant="info">
                    {m}
                  </Tag>
                ))}
              </Flex>
            )}

            <Divider />

            {lead.cameFrom && <Text>Came from: {lead.cameFrom}</Text>}

            {lead.summary ? (
              <Flex direction="column" gap="flush">
                {lead.summary[version].map((line, j) => (
                  <Text key={j} format={j === 0 ? { fontWeight: "bold" } : undefined}>
                    {line}
                  </Text>
                ))}
              </Flex>
            ) : (
              <Text variant="microcopy">The visit summary could not be made just now.</Text>
            )}

            <Flex direction="row" gap="small" align="center">
              {lead.chartUrl && (
                <Button size="sm" variant="primary" onClick={() => actions.openIframeModal({ uri: lead.chartUrl, height: 820, width: 1280, title: "Visit chart", flush: true })}>
                  Open visit chart
                </Button>
              )}
              <Link href={{ url: lead.jellyhookUrl, external: true }}>Open in Jellyhook</Link>
            </Flex>
          </Flex>
        </Tile>
      ))}
    </Flex>
  );
}
