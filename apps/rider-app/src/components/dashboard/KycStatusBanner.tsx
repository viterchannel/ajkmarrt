import { AlertTriangle, CheckCircle, ChevronRight, Clock, FileText, Truck, XCircle } from "lucide-react";
import { Link } from "wouter";

interface KycStatusBannerProps {
  kycStatus: string | undefined;
  vehicleType: string | undefined;
  vehiclePhoto: string | undefined;
  drivingLicense: string | undefined;
  rejectionReason?: string | null;
}

interface CheckItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  done: boolean;
}

export function KycStatusBanner({
  kycStatus,
  vehicleType,
  vehiclePhoto,
  drivingLicense,
  rejectionReason,
}: KycStatusBannerProps) {
  if (kycStatus === "approved") return null;

  const isRejected = kycStatus === "rejected";
  const isPending = kycStatus === "pending";

  const checks: CheckItem[] = [
    {
      key: "vehicleType",
      label: "Vehicle type selected",
      icon: <Truck size={12} />,
      done: !!vehicleType,
    },
    {
      key: "vehiclePhoto",
      label: "Vehicle photo uploaded",
      icon: <FileText size={12} />,
      done: !!vehiclePhoto,
    },
    {
      key: "drivingLicense",
      label: "Driving license number added",
      icon: <FileText size={12} />,
      done: !!drivingLicense,
    },
    {
      key: "kycApproval",
      label: "KYC approved by admin",
      icon: <CheckCircle size={12} />,
      done: kycStatus === "approved",
    },
  ];

  const missingItems = checks.filter((c) => !c.done);
  const firstMissing = missingItems[0];
  const allDocsSubmitted = missingItems.length === 1 && firstMissing != null && firstMissing.key === "kycApproval";

  let borderColor: string;
  let bgColor: string;
  let iconColor: string;
  let titleColor: string;
  let headerIcon: React.ReactNode;
  let title: string;
  let subtitle: string;

  if (isRejected) {
    borderColor = "border-error/30";
    bgColor = "bg-error/10";
    iconColor = "text-error";
    titleColor = "text-error";
    headerIcon = <XCircle size={15} className="flex-shrink-0 text-error" />;
    title = "KYC Rejected — Action Required";
    subtitle = rejectionReason
      ? `Reason: ${rejectionReason}`
      : "Your documents were rejected. Please re-upload corrected documents.";
  } else if (isPending || allDocsSubmitted) {
    borderColor = "border-blue-400/30";
    bgColor = "bg-blue-500/10";
    iconColor = "text-blue-400";
    titleColor = "text-blue-300";
    headerIcon = <Clock size={15} className="flex-shrink-0 text-blue-400" />;
    title = "KYC Under Review";
    subtitle = "Your documents have been submitted and are being reviewed by our team.";
  } else {
    borderColor = "border-warning/30";
    bgColor = "bg-warning/10";
    iconColor = "text-warning";
    titleColor = "text-warning";
    headerIcon = <AlertTriangle size={15} className="flex-shrink-0 text-warning" />;
    title = "KYC Incomplete — Cannot Accept Rides";
    subtitle = "Complete the steps below to start accepting ride requests.";
  }

  return (
    <Link href="/profile">
      <div
        className={`flex cursor-pointer items-start gap-3 rounded-2xl border ${borderColor} ${bgColor} px-4 py-3 transition-transform active:scale-[0.98]`}
        role="alert"
        aria-label="KYC verification status"
      >
        {headerIcon}

        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold ${titleColor}`}>{title}</p>
          <p className={`mt-0.5 text-[10px] leading-relaxed ${iconColor} opacity-80`}>{subtitle}</p>

          {!isPending && !allDocsSubmitted && (
            <div className="mt-2 space-y-1">
              {checks.map((item) => (
                <div key={item.key} className="flex items-center gap-1.5">
                  {item.done ? (
                    <CheckCircle size={11} className="flex-shrink-0 text-success" />
                  ) : (
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full border border-current opacity-60" style={{ color: isRejected ? "var(--color-error)" : "var(--color-warning)" }} />
                  )}
                  <span
                    className={`text-[10px] font-medium ${
                      item.done ? "text-success" : isRejected ? "text-error/80" : "text-warning/80"
                    }`}
                  >
                    {item.label}
                    {item.done && " ✓"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className={`mt-2 flex items-center gap-0.5 text-[10px] font-bold ${titleColor} underline underline-offset-2`}>
            {isRejected ? "Re-upload documents" : isPending || allDocsSubmitted ? "View profile" : "Complete profile"}
            <ChevronRight size={10} />
          </p>
        </div>
      </div>
    </Link>
  );
}
