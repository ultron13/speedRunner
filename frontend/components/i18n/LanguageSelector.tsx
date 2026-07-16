"use client";

import { Globe } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18nStore } from "@/store/i18n-store";

export function LanguageSelector() {
  const locale = useI18nStore((state) => state.locale);
  const locales = useI18nStore((state) => state.locales);
  const setLocale = useI18nStore((state) => state.setLocale);

  return (
    <section aria-labelledby="language-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="px-5 py-4">
          <CardTitle id="language-heading" className="text-base flex items-center gap-2">
            <Globe className="size-4" />
            Language
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="grid gap-2">
            <Label>Select Language</Label>
            <Select value={locale.code} onValueChange={setLocale}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((loc) => (
                  <SelectItem key={loc.code} value={loc.code}>
                    {loc.nativeName} ({loc.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Current: {locale.nativeName}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
