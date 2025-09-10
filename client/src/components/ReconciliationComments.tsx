import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { safeFormat } from "@/lib/dateUtils";
import { MessageSquare, Plus, Edit2, Trash2, Save, X } from "lucide-react";

interface ReconciliationCommentsProps {
  deliveryId: number;
  className?: string;
}

interface ReconciliationComment {
  id: number;
  content: string;
  deliveryId: number;
  authorId: string;
  groupId: number;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    email: string;
    role: string;
  };
}

export default function ReconciliationComments({ deliveryId, className = "" }: ReconciliationCommentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newComment, setNewComment] = useState("");
  const [editComment, setEditComment] = useState("");

  // Récupérer les commentaires
  const { data: comments = [], isLoading } = useQuery({
    queryKey: [`/api/deliveries/${deliveryId}/reconciliation-comments`],
    queryFn: () => apiRequest(`/api/deliveries/${deliveryId}/reconciliation-comments`),
    enabled: !!deliveryId,
  });

  // Créer un commentaire
  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/deliveries/${deliveryId}/reconciliation-comments`, "POST", { content });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Commentaire ajouté avec succès",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/deliveries/${deliveryId}/reconciliation-comments`] });
      setIsAdding(false);
      setNewComment("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible d'ajouter le commentaire",
        variant: "destructive",
      });
    },
  });

  // Modifier un commentaire
  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      return apiRequest(`/api/reconciliation-comments/${id}`, "PUT", { content });
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Commentaire modifié avec succès",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/deliveries/${deliveryId}/reconciliation-comments`] });
      setEditingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de modifier le commentaire",
        variant: "destructive",
      });
    },
  });

  // Supprimer un commentaire
  const deleteCommentMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/reconciliation-comments/${id}`, "DELETE");
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Commentaire supprimé avec succès",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/deliveries/${deliveryId}/reconciliation-comments`] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de supprimer le commentaire",
        variant: "destructive",
      });
    },
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    createCommentMutation.mutate(newComment);
  };

  const handleEditComment = (comment: ReconciliationComment) => {
    setEditingId(comment.id);
    setEditComment(comment.content);
  };

  const handleSaveEdit = () => {
    if (!editComment.trim() || !editingId) return;
    
    updateCommentMutation.mutate({
      id: editingId,
      content: editComment,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditComment("");
  };

  const handleDeleteComment = (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce commentaire ?")) {
      deleteCommentMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
        <div className="h-20 bg-gray-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900 flex items-center">
          <MessageSquare className="w-4 h-4 mr-2" />
          Commentaires
          {comments.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {comments.length}
            </Badge>
          )}
        </h4>
        
        <Button
          onClick={() => setIsAdding(true)}
          size="sm"
          variant="outline"
          className="text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Formulaire d'ajout */}
      {isAdding && (
        <Card className="mb-4 border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <form onSubmit={handleAddComment} className="space-y-3">
              <div>
                <Label htmlFor="new-comment">Nouveau commentaire</Label>
                <Textarea
                  id="new-comment"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Tapez votre commentaire..."
                  rows={3}
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAdding(false);
                    setNewComment("");
                  }}
                >
                  <X className="w-3 h-3 mr-1" />
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createCommentMutation.isPending || !newComment.trim()}
                >
                  <Save className="w-3 h-3 mr-1" />
                  {createCommentMutation.isPending ? "Ajout..." : "Ajouter"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Liste des commentaires */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Aucun commentaire pour cette livraison</p>
          </div>
        ) : (
          comments.map((comment: ReconciliationComment) => {
            const isEditing = editingId === comment.id;
            
            return (
              <Card key={comment.id} className="border">
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`edit-content-${comment.id}`}>Commentaire</Label>
                        <Textarea
                          id={`edit-content-${comment.id}`}
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={updateCommentMutation.isPending || !editComment.trim()}
                        >
                          <Save className="w-3 h-3 mr-1" />
                          {updateCommentMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-gray-900 mb-2">{comment.content}</p>
                          <div className="text-xs text-gray-500">
                            Par {comment.author.email} • {safeFormat(comment.createdAt, "dd/MM/yyyy 'à' HH:mm")}
                          </div>
                        </div>
                        
                        <div className="flex space-x-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditComment(comment)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}