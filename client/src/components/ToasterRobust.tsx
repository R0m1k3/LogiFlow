import { useToast } from "@/hooks/use-toast-robust";
import { X, CheckCircle, AlertCircle, XCircle } from "lucide-react";

export function ToasterRobust() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex max-h-screen w-full max-w-[420px] flex-col-reverse gap-2">
      {toasts.map((toast) => {
        const variants = {
          default: {
            container: "border border-blue-200 bg-blue-50 text-blue-900",
            icon: <CheckCircle className="h-5 w-5 text-blue-600" />
          },
          success: {
            container: "border border-green-200 bg-green-50 text-green-900",
            icon: <CheckCircle className="h-5 w-5 text-green-600" />
          },
          destructive: {
            container: "border border-red-200 bg-red-50 text-red-900",
            icon: <XCircle className="h-5 w-5 text-red-600" />
          }
        };

        const variant = variants[toast.variant || "default"];

        return (
          <div
            key={toast.id}
            className={`group pointer-events-auto relative flex w-full items-start space-x-3 overflow-hidden rounded-lg p-4 shadow-lg transition-all duration-200 ${variant.container}`}
          >
            <div className="flex-shrink-0">
              {variant.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              {toast.title && (
                <div className="text-sm font-medium">
                  {toast.title}
                </div>
              )}
              {toast.description && (
                <div className="mt-1 text-sm opacity-90">
                  {toast.description}
                </div>
              )}
            </div>
            
            <button
              onClick={() => dismiss(toast.id)}
              className="flex-shrink-0 ml-3 inline-flex text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}