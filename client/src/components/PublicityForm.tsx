import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { safeDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { PublicityWithRelations, Group } from "@shared/schema";

const publicityFormSchema = z.object({
  pubNumber: z.string().min(1, "Le numéro PUB est requis"),
  designation: z.string().min(1, "La désignation est requise"),
  startDate: z.date({ required_error: "La date de début est requise" }),
  endDate: z.date({ required_error: "La date de fin est requise" }),
  year: z.number().min(2020).max(2030),
  participatingGroups: z.array(z.number()), // Suppression de .min(1) pour permettre 0 magasin
}).refine((data) => data.endDate >= data.startDate, {
  message: "La date de fin doit être postérieure à la date de début",
  path: ["endDate"]
});

type PublicityFormData = z.infer<typeof publicityFormSchema>;

interface PublicityFormProps {
  publicity?: PublicityWithRelations | null;
  groups: Group[];
  onSuccess: () => void;
  selectedYear?: number; // Année sélectionnée depuis le filtre principal
}

export default function PublicityForm({ publicity, groups, onSuccess, selectedYear }: PublicityFormProps) {
  const [startCalendarOpen, setStartCalendarOpen] = useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<PublicityFormData>({
    resolver: zodResolver(publicityFormSchema),
    defaultValues: {
      pubNumber: publicity?.pubNumber || "",
      designation: publicity?.designation || "",
      startDate: publicity?.startDate ? safeDate(publicity.startDate) : undefined,
      endDate: publicity?.endDate ? safeDate(publicity.endDate) : undefined,
      year: publicity?.year || selectedYear || 2025, // Utilise l'année sélectionnée ou 2025 par défaut
      participatingGroups: publicity?.participations?.map(p => p.groupId) || [],
    },
  });

  // L'année est définie manuellement par l'utilisateur, pas automatiquement par la date

  const createMutation = useMutation({
    mutationFn: async (data: PublicityFormData) => {
      const response = await fetch('/api/publicities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubNumber: data.pubNumber,
          designation: data.designation,
          startDate: format(data.startDate, 'yyyy-MM-dd'),
          endDate: format(data.endDate, 'yyyy-MM-dd'),
          year: data.year,
          participatingGroups: data.participatingGroups,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de la création');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/publicities'] });
      toast({ description: "Publicité créée avec succès" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Erreur lors de la création" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PublicityFormData) => {
      const response = await fetch(`/api/publicities/${publicity!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pubNumber: data.pubNumber,
          designation: data.designation,
          startDate: format(data.startDate, 'yyyy-MM-dd'),
          endDate: format(data.endDate, 'yyyy-MM-dd'),
          year: data.year,
          participatingGroups: data.participatingGroups,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de la modification');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/publicities'] });
      toast({ description: "Publicité modifiée avec succès" });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Erreur lors de la modification" 
      });
    }
  });

  const onSubmit = (data: PublicityFormData) => {
    if (publicity) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pubNumber">N° PUB</Label>
          <Input
            id="pubNumber"
            {...form.register("pubNumber")}
            placeholder="Ex: PUB2025-001"
          />
          {form.formState.errors.pubNumber && (
            <p className="text-sm text-red-600">{form.formState.errors.pubNumber.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="year">Année</Label>
          <Input
            id="year"
            type="number"
            {...form.register("year", { valueAsNumber: true })}
            min="2020"
            max="2030"
          />
          {form.formState.errors.year && (
            <p className="text-sm text-red-600">{form.formState.errors.year.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="designation">Désignation</Label>
        <Textarea
          id="designation"
          {...form.register("designation")}
          placeholder="Description de la campagne publicitaire"
          rows={3}
        />
        {form.formState.errors.designation && (
          <p className="text-sm text-red-600">{form.formState.errors.designation.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date de début</Label>
          <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !form.watch("startDate") && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch("startDate") ? (
                  format(form.watch("startDate"), "dd/MM/yyyy", { locale: fr })
                ) : (
                  <span>Sélectionner une date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch("startDate")}
                onSelect={(date) => {
                  form.setValue("startDate", date!);
                  setStartCalendarOpen(false);
                }}
                disabled={(date) => date < new Date("1900-01-01")}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
          {form.formState.errors.startDate && (
            <p className="text-sm text-red-600">{form.formState.errors.startDate.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Date de fin</Label>
          <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !form.watch("endDate") && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch("endDate") ? (
                  format(form.watch("endDate"), "dd/MM/yyyy", { locale: fr })
                ) : (
                  <span>Sélectionner une date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={form.watch("endDate")}
                onSelect={(date) => {
                  form.setValue("endDate", date!);
                  setEndCalendarOpen(false);
                }}
                disabled={(date) => {
                  const startDate = form.watch("startDate");
                  return date < new Date("1900-01-01") || (startDate && date < startDate);
                }}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
          {form.formState.errors.endDate && (
            <p className="text-sm text-red-600">{form.formState.errors.endDate.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Magasins participants</Label>
        <p className="text-sm text-gray-600">Sélectionnez les magasins qui participent à cette publicité (optionnel)</p>
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`group-${group.id}`}
                    checked={form.watch("participatingGroups").includes(group.id)}
                    onCheckedChange={(checked) => {
                      const current = form.watch("participatingGroups");
                      if (checked) {
                        form.setValue("participatingGroups", [...current, group.id]);
                      } else {
                        form.setValue("participatingGroups", current.filter(id => id !== group.id));
                      }
                    }}
                  />
                  <Label
                    htmlFor={`group-${group.id}`}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: group.color }}
                    />
                    <span>{group.name}</span>
                  </Label>
                </div>
              ))}
            </div>
            {form.watch("participatingGroups").length === 0 && (
              <div className="mt-3 p-3 bg-red-50 rounded-lg text-center">
                <p className="text-sm text-red-700">Aucun magasin sélectionné</p>
              </div>
            )}
          </CardContent>
        </Card>
        {form.formState.errors.participatingGroups && (
          <p className="text-sm text-red-600">{form.formState.errors.participatingGroups.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onSuccess}
          disabled={isLoading}
        >
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              {publicity ? 'Modification...' : 'Création...'}
            </div>
          ) : (
            publicity ? 'Modifier' : 'Créer'
          )}
        </Button>
      </div>
    </form>
  );
}