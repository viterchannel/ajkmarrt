import { PageHeader } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { safeCopyToClipboard } from "@/lib/safeClipboard";
import { AjkmartLogo, SERVICE_COLORS } from "@workspace/ui";
import type { ServiceColorEntry } from "@workspace/ui";
import { Check, Copy, Palette, Shapes } from "lucide-react";
import { useState } from "react";

const LOGO_VARIANTS = [
  {
    variant: "full" as const,
    label: "Full",
    description: "Primary logo with wordmark and tagline",
    size: 160,
  },
  {
    variant: "compact" as const,
    label: "Compact",
    description: "Mark + wordmark side by side",
    size: 160,
  },
  {
    variant: "mark" as const,
    label: "Mark",
    description: "Icon-only badge for favicons and app icons",
    size: 80,
  },
  {
    variant: "mono" as const,
    label: "Mono",
    description: "Single-color wordmark for restricted palettes",
    size: 160,
  },
];

function HexCopyButton({ hex }: { hex: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await safeCopyToClipboard(hex);
    setCopied(true);
    toast({ title: "Copied!", description: `${hex} copied to clipboard.` });
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-mono transition-colors hover:bg-gray-100 active:bg-gray-200"
      title={`Copy ${hex}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-gray-400" />
      )}
      {hex}
    </button>
  );
}

function LogoCard({
  variant,
  label,
  description,
  size,
}: {
  variant: "full" | "compact" | "mark" | "mono";
  label: string;
  description: string;
  size: number;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{label}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {variant}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3 pb-4">
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border bg-white p-6">
          <AjkmartLogo variant={variant} size={size} theme="light" />
        </div>
        <div className="flex min-h-[120px] items-center justify-center rounded-lg border bg-[#0b0e11] p-6">
          <AjkmartLogo variant={variant} size={size} theme="dark" />
        </div>
        <div className="flex justify-center gap-2">
          <Badge variant="outline" className="text-xs">
            Light
          </Badge>
          <Badge
            variant="outline"
            className="border-gray-700 bg-gray-900 text-xs text-gray-300"
          >
            Dark
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceColorSwatch({ entry }: { entry: ServiceColorEntry }) {
  const gradientStyle = {
    background: `linear-gradient(135deg, ${entry.gradient[0]}, ${entry.gradient[1]})`,
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-24 w-full" style={gradientStyle} />
      <CardContent className="space-y-2 pt-3 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{entry.name}</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {entry.id}
          </Badge>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Primary</span>
            <HexCopyButton hex={entry.color} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Gradient start</span>
            <HexCopyButton hex={entry.gradient[0]} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Gradient end</span>
            <HexCopyButton hex={entry.gradient[1]} />
          </div>
        </div>

        <div className="pt-1">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Light bg / text</p>
          <div className="flex gap-2">
            <span
              className="flex-1 rounded px-2 py-1 text-center text-xs font-medium"
              style={{ background: entry.bgLight, color: entry.textLight }}
            >
              {entry.name}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <HexCopyButton hex={entry.bgLight} />
            <HexCopyButton hex={entry.textLight} />
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Dark bg / text</p>
          <div className="flex gap-2">
            <span
              className="flex-1 rounded px-2 py-1 text-center text-xs font-medium"
              style={{ background: entry.bgDark, color: entry.textDark }}
            >
              {entry.name}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <HexCopyButton hex={entry.bgDark} />
            <HexCopyButton hex={entry.textDark} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BrandGuidelines() {
  const { toast } = useToast();

  const serviceEntries = Object.values(SERVICE_COLORS);

  async function copyAllTokens() {
    const lines = serviceEntries.flatMap((e) => [
      `/* ${e.name} */`,
      `--color-${e.id}: ${e.color};`,
      `--color-${e.id}-gradient-from: ${e.gradient[0]};`,
      `--color-${e.id}-gradient-to: ${e.gradient[1]};`,
      `--color-${e.id}-bg-light: ${e.bgLight};`,
      `--color-${e.id}-text-light: ${e.textLight};`,
      `--color-${e.id}-bg-dark: ${e.bgDark};`,
      `--color-${e.id}-text-dark: ${e.textDark};`,
      "",
    ]);
    await safeCopyToClipboard(`:root {\n${lines.join("\n")}\n}`);
    toast({ title: "All CSS tokens copied!", description: "Paste into your stylesheet." });
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Brand Guidelines"
        subtitle="Logo variants and service color tokens for AJKMart"
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          <Shapes className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Logo Variants</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Each variant is shown on a light and dark background. Use the variant that best fits the
          available space and context.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {LOGO_VARIANTS.map((lv) => (
            <LogoCard key={lv.variant} {...lv} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Service Colors</h2>
          </div>
          <Button variant="outline" size="sm" onClick={copyAllTokens}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy all CSS tokens
          </Button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Each service has a primary color, gradient pair, and light/dark context colors. Click any
          hex value to copy it.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {serviceEntries.map((entry) => (
            <ServiceColorSwatch key={entry.id} entry={entry} />
          ))}
        </div>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">App Color Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: "Admin Primary", hex: "#1A56DB", desc: "Blue — Admin panel accent" },
                { label: "Admin Accent", hex: "#F59E0B", desc: "Amber — highlights & badges" },
                { label: "Rider Gold", hex: "#F0B90B", desc: "Gold — Rider app accent" },
                { label: "Rider Dark BG", hex: "#0b0e11", desc: "Near-black — Rider background" },
                { label: "Brand Navy", hex: "#0D1B4B", desc: "Navy — Logo text / primary brand" },
                { label: "Brand Orange", hex: "#FF6B00", desc: "Orange — Cart icon gradient" },
              ].map(({ label, hex, desc }) => (
                <div
                  key={hex}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div
                    className="h-10 w-10 flex-shrink-0 rounded-md border"
                    style={{ background: hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                    <HexCopyButton hex={hex} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
