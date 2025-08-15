import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};



export default function DateWidget() {
  const now = new Date();

  return (
    <Card className="bg-gradient-to-r from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl transition-all duration-300">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full">
            <Calendar className="h-5 w-5 text-slate-600 dark:text-slate-300" />
          </div>
          <div className="flex flex-col">
            <span className="text-slate-700 dark:text-slate-200 font-semibold text-sm capitalize">
              {formatDate(now)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}