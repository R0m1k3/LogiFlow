import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { safeFormat } from "@/lib/dateUtils";
import { MessageSquare, Plus, Edit2, Trash2, Save, X, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";

interface ReconciliationCommentsProps {
  deliveryId: number;
  className?: string;
}

interface ReconciliationComment {
  id: number;
  content: string;
  type: 'warning' | 'error' | 'success';
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

const typeColors = {
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  error: "bg-red-50 border-red-200 text-red-800",
  success: "bg-green-50 border-green-200 text-green-800",
};

const typeIcons = {
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

const typeLabels = {
  warning: "Attention",
  error: "Erreur",
  success: "Succès",
};

export default function ReconciliationComments({ deliveryId, className = "" }: ReconciliationCommentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newComment, setNewComment] = useState<{
    content: string;
    type: 'warning' | 'error' | 'success';
  }>({
    content: "",
    type: "warning",
  });
  const [editComment, setEditComment] = useState<{
    content: string;
    type: 'warning' | 'error' | 'success';
  }>({
    content: "",
    type: "warning",
  });

  // Récupérer les commentaires
  const { data: comments = [], isLoading } = useQuery({
    queryKey: [`/api/deliveries/${deliveryId}/reconciliation-comments`],
    queryFn: () => apiRequest(`/api/deliveries/${deliveryId}/reconciliation-comments`),
    enabled: !!deliveryId,
  });

  // Créer un commentaire
  const createCommentMutation = useMutation({
    mutationFn: async (data: { content: string; type: string }) => {
      return apiRequest(`/api/deliveries/${deliveryId}/reconciliation-comments`, "POST", data);
    },
    onSuccess: () => {
      toast({
        title: "Succès",
        description: "Commentaire ajouté avec succès",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/deliveries/${deliveryId}/reconciliation-comments`] });
      setIsAdding(false);
      setNewComment({ content: "", type: "warning" });
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
    mutationFn: async ({ id, data }: { id: number; data: { content: string; type: string } }) => {
      return apiRequest(`/api/reconciliation-comments/${id}`, "PUT", data);
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
    if (!newComment.content.trim()) return;
    
    createCommentMutation.mutate(newComment);
  };

  const handleEditComment = (comment: ReconciliationComment) => {
    setEditingId(comment.id);
    setEditComment({
      content: comment.content,
      type: comment.type,
    });
  };

  const handleSaveEdit = () => {
    if (!editComment.content.trim() || !editingId) return;
    
    updateCommentMutation.mutate({
      id: editingId,
      data: editComment,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditComment({ content: "", type: "warning" });
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
          Commentaires de rapprochement
          {comments.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {comments.length}
            </Badge>
          )}
        </h4>
        
        {!isAdding && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        )}
      </div>

      {/* Formulaire d'ajout */}
      {isAdding && (
        <Card className="mb-4 border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Nouveau commentaire</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddComment} className="space-y-3">
              <div>
                <Label htmlFor="comment-type">Type</Label>
                <Select
                  value={newComment.type}
                  onValueChange={(value: any) => setNewComment(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger id="comment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>

                    <SelectItem value="warning">Attention</SelectItem>
                    <SelectItem value="error">Erreur</SelectItem>
                    <SelectItem value="success">Succès</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="comment-content">Commentaire</Label>
                <Textarea
                  id="comment-content"
                  value={newComment.content}
                  onChange={(e) => setNewComment(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Saisissez votre commentaire..."
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsAdding(false);
                    setNewComment({ content: "", type: "warning" });
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newComment.content.trim() || createCommentMutation.isPending}
                >
                  <Save className="w-4 h-4 mr-1" />
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
            const TypeIcon = typeIcons[comment.type];
            const isEditing = editingId === comment.id;
            
            return (
              <Card key={comment.id} className={`border ${typeColors[comment.type]}`}>
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`edit-type-${comment.id}`}>Type</Label>
                        <Select
                          value={editComment.type}
                          onValueChange={(value: any) => setEditComment(prev => ({ ...prev, type: value }))}
                        >
                          <SelectTrigger id={`edit-type-${comment.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
        
                            <SelectItem value="warning">Attention</SelectItem>
                            <SelectItem value="error">Erreur</SelectItem>
                            <SelectItem value="success">Succès</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor={`edit-content-${comment.id}`}>Commentaire</Label>
                        <Textarea
                          id={`edit-content-${comment.id}`}
                          value={editComment.content}
                          onChange={(e) => setEditComment(prev => ({ ...prev, content: e.target.value }))}
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
                          <X className="w-4 h-4 mr-1" />
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={!editComment.content.trim() || updateCommentMutation.isPending}
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {updateCommentMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <TypeIcon className="w-4 h-4" />
                          <Badge variant="outline">
                            {typeLabels[comment.type]}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditComment(comment)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      
                      <p className="text-sm mb-2">{comment.content}</p>
                      
                      <div className="text-xs text-gray-500 flex items-center justify-between">
                        <span>Par {comment.author.email}</span>
                        <span>{safeFormat(new Date(comment.createdAt), 'dd/MM/yyyy HH:mm')}</span>
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