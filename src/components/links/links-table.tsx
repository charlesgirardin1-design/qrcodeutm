"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, QrCode, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, getAppUrl } from "@/lib/utils";
import type { LinkListItem } from "@/types";

export function LinksTable() {
  const [links, setLinks] = useState<LinkListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(q?: string) {
    setLoading(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`/api/links${params}`);
      const data = await res.json();
      setLinks(data.links ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => load(query), 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function toggleActive(link: LinkListItem) {
    setLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, isActive: !l.isActive } : l)));
    await fetch(`/api/links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !link.isActive }),
    });
  }

  async function deleteLink(link: LinkListItem) {
    if (!confirm(`Supprimer le lien ${link.slug} ? Cette action est irréversible.`)) return;
    await fetch(`/api/links/${link.id}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="border-b p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un lien, une campagne..."
              className="pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="p-3 font-medium">Lien</th>
                <th className="p-3 font-medium">Campagne</th>
                <th className="p-3 font-medium">Clics</th>
                <th className="p-3 font-medium">Créé le</th>
                <th className="p-3 font-medium">Actif</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {!loading && links.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Aucun lien pour le moment.
                  </td>
                </tr>
              )}
              {links.map((link) => {
                const shortUrl = `${getAppUrl()}/${link.slug}`;
                return (
                  <tr key={link.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="max-w-xs p-3">
                      <Link href={`/links/${link.id}`} className="font-medium hover:underline">
                        /{link.slug}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">{link.destinationUrl}</p>
                    </td>
                    <td className="p-3">
                      {link.utmCampaign ? <Badge variant="outline">{link.utmCampaign}</Badge> : "—"}
                    </td>
                    <td className="p-3 tabular-nums">{link._count.clicks}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(link.createdAt, { dateStyle: "short" })}</td>
                    <td className="p-3">
                      <Switch checked={link.isActive} onCheckedChange={() => toggleActive(link)} />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => navigator.clipboard.writeText(shortUrl)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/qr-studio?linkId=${link.id}`}>
                            <QrCode className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <a href={shortUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteLink(link)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
