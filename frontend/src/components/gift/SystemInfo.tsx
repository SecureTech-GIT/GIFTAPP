import React from "react";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AccordionSection } from "@/components/ui/accordian-section";

interface SystemInfoProps {
  gift: {
    owner?: string;
    creation?: string;
    modified_by?: string;
    modified?: string;
  };
  formatDate: (date: string) => string;
}

export function SystemInfo({ gift, formatDate }: SystemInfoProps) {
  const { t } = useTranslation();

  const items = [
    {
      label: t("gift.systemInfo.createdBy"),
      value: gift.owner || t("gift.systemInfo.administrator"),
    },
    {
      label: t("gift.systemInfo.createdOn"),
      value: gift.creation ? formatDate(gift.creation) : "-",
    },
    {
      label: t("gift.systemInfo.lastModifiedBy"),
      value: gift.modified_by || "-",
    },
    {
      label: t("gift.systemInfo.lastModifiedOn"),
      value: gift.modified ? formatDate(gift.modified) : "-",
    },
  ];

  return (
    <AccordionSection icon={<Clock />} title={t("gift.systemInfo.auditLog")}>
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex flex-col">
            <p className="text-[11px] font-medium text-muted-foreground mb-1">
              {item.label}
            </p>
            <p className="text-sm font-medium text-foreground break-words">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </AccordionSection>
  );
}
