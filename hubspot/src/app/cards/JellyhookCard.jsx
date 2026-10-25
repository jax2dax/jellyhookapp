// hubspot/src/app/cards/JellyhookCard.jsx
// The Jellyhook card on a HubSpot contact record (middle column). Asks Jellyhook (app/api/hubspot/card, signed by
// HubSpot) what this contact did on the website before sending the form: each of their Jellyhook leads with its visit
// summary (Short / Moderate / Long), team marks, the hooks that caught it, where it came from, and "Open visit chart",
// which opens the real chart in a HubSpot modal (app/embed/visit). Design: mds/build/integrations/hubspot.md.
import React, { useEffect, useState } from "react";
import { Button, Divider, EmptyState, ErrorState, Flex, Link, LoadingSpinner, Tag, Text, hubspot } from "@hubspot/ui-extensions";

const CARD_URL = "https://jellyhook.com/api/hubspot/card";
const VERSIONS = [
  ["short", "Short"],
  ["moderate", "Moderate"],
  ["long", "Long"],
];

hubspot.extend(({ context, actions }) => <JellyhookCard context={context} actions={actions} />);

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

  return (
    <Flex direction="column" gap="medium">
      <Flex direction="row" gap="extra-small" align="center" wrap="wrap">
        <Text variant="microcopy">Summary:</Text>
        {VERSIONS.map(([v, label]) => (
          <Button key={v} size="xs" variant={v === version ? "primary" : "secondary"} onClick={() => setVersion(v)}>
            {label}
          </Button>
        ))}
      </Flex>
      {answer.leads.map((lead, i) => (
        <Flex key={lead.id} direction="column" gap="small">
          {i > 0 && <Divider />}
          <Text format={{ fontWeight: "bold" }}>
            Form sent {when(lead.submittedAt)}
            {lead.page ? " on " + lead.page : ""}
            {lead.form ? " (" + lead.form + ")" : ""} · {lead.site}
          </Text>
          {lead.cameFrom && <Text variant="microcopy">Came from: {lead.cameFrom}</Text>}
          {(lead.hooks.length > 0 || lead.marks.length > 0) && (
            <Flex direction="row" gap="extra-small" wrap="wrap">
              {lead.hooks.map((h) => (
                <Tag key={"h" + h} variant="success">
                  Hook: {h}
                </Tag>
              ))}
              {lead.marks.map((m) => (
                <Tag key={"m" + m}>{m}</Tag>
              ))}
            </Flex>
          )}
          {lead.summary ? (
            <Flex direction="column" gap="flush">
              {lead.summary[version].map((line, j) => (
                <Text key={j}>{line}</Text>
              ))}
            </Flex>
          ) : (
            <Text variant="microcopy">The visit summary could not be made just now.</Text>
          )}
          <Flex direction="row" gap="small" align="center">
            {lead.chartUrl && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => actions.openIframeModal({ uri: lead.chartUrl, height: 820, width: 1280, title: "Visit chart", flush: true })}
              >
                Open visit chart
              </Button>
            )}
            <Link href={{ url: lead.jellyhookUrl, external: true }}>Open in Jellyhook</Link>
          </Flex>
        </Flex>
      ))}
    </Flex>
  );
}
