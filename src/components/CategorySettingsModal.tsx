import { useState } from "react";
import {
  RefreshCcw,
  Smile,
  Image as ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { useToast } from "../hooks/use-toast";
import useCategoryStore from "../stores/categoryStore";
import useAuthStore from "@/stores/authStore";

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#84cc16",
  "#6b7280",
];

interface CategorySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CategorySettingsModal: React.FC<CategorySettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    categories,
    updateCategoryIcon,
    resetCategories,
    addCategory,
    deleteCategory,
  } = useCategoryStore();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newIcon, setNewIcon] = useState("");
  const [iconType, setIconType] = useState<"emoji" | "image">("emoji");

  // Nueva categoría
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📌");
  const [newCatColor, setNewCatColor] = useState("#6b7280");

  const handleSaveEdit = () => {
    if (editingKey && newIcon) {
      updateCategoryIcon(editingKey, newIcon, iconType, user?.id);
      setEditingKey(null);
      toast({ title: "Categoría actualizada" });
    }
  };

  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return;
    addCategory(
      newCatLabel.trim(),
      {
        label: newCatLabel.trim(),
        icon: newCatIcon,
        color: newCatColor,
        type: "emoji",
        isCustom: true,
      },
      user?.id,
    );
    setNewCatLabel("");
    setNewCatIcon("📌");
    setNewCatColor("#6b7280");
    setShowAddForm(false);
    toast({ title: `Categoría "${newCatLabel}" creada` });
  };

  const handleDelete = (key: string) => {
    if (confirm(`¿Eliminar la categoría "${categories[key]?.label}"?`)) {
      deleteCategory(key, user?.id);
      toast({ title: "Categoría eliminada" });
    }
  };

  const handleReset = () => {
    if (
      confirm("¿Restablecer todas las categorías a sus valores por defecto?")
    ) {
      resetCategories(user?.id);
      toast({ title: "Categorías restablecidas" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎨 Personalizar Categorías
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Botones superiores */}
          <div className="flex justify-between items-center">
            <Button
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus size={13} /> Nueva categoría
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs"
            >
              <RefreshCcw className="mr-1 h-3 w-3" /> Restablecer
            </Button>
          </div>

          {/* Formulario nueva categoría */}
          {showAddForm && (
            <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/20">
              <p className="text-xs font-semibold">Nueva categoría</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre (ej: Mascotas)"
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Emoji"
                  value={newCatIcon}
                  onChange={(e) => setNewCatIcon(e.target.value)}
                  className="w-16 text-center text-lg"
                  maxLength={2}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Color</p>
                <div className="flex gap-2 flex-wrap">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor:
                          newCatColor === color ? "white" : "transparent",
                      }}
                      onClick={() => setNewCatColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddCategory}
                  disabled={!newCatLabel.trim()}
                >
                  Crear categoría
                </Button>
              </div>
            </div>
          )}

          {/* Lista de categorías */}
          <div className="grid grid-cols-1 gap-2">
            {Object.entries(categories).map(([key, config]) => (
              <div
                key={key}
                className="flex flex-col p-3 border rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-lg border overflow-hidden"
                      style={{ borderColor: config.color }}
                    >
                      {config.type === "image" ? (
                        <img
                          src={config.icon}
                          alt={config.label}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{config.icon}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-sm font-medium">
                        {config.label}
                      </span>
                      {config.isCustom && (
                        <Badge
                          variant="secondary"
                          className="ml-2 text-[9px] px-1 py-0"
                        >
                          Custom
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {editingKey !== key && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => {
                          setEditingKey(key);
                          setNewIcon(config.icon);
                          setIconType(config.type ?? "emoji");
                        }}
                      >
                        Editar
                      </Button>
                    )}
                    {config.isCustom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7 px-2 text-red-400 hover:text-red-500"
                        onClick={() => handleDelete(key)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Editor inline */}
                {editingKey === key && (
                  <div className="mt-3 p-3 bg-muted/30 rounded-md">
                    <Tabs
                      value={iconType}
                      onValueChange={(v) => setIconType(v as "emoji" | "image")}
                    >
                      <TabsList className="grid w-full grid-cols-2 mb-3">
                        <TabsTrigger value="emoji">
                          <Smile className="mr-1 h-3 w-3" /> Emoji
                        </TabsTrigger>
                        <TabsTrigger value="image">
                          <ImageIcon className="mr-1 h-3 w-3" /> URL
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="emoji">
                        <Input
                          value={newIcon}
                          onChange={(e) => setNewIcon(e.target.value)}
                          className="text-center text-lg"
                          placeholder="Emoji"
                          maxLength={2}
                          autoFocus
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Win + . o Cmd + Ctrl + Espacio
                        </p>
                      </TabsContent>
                      <TabsContent value="image">
                        <Input
                          value={newIcon}
                          onChange={(e) => setNewIcon(e.target.value)}
                          placeholder="https://ejemplo.com/icono.png"
                          autoFocus
                        />
                        {newIcon && (
                          <div className="flex items-center gap-2 mt-2 p-2 border rounded">
                            <span className="text-xs text-muted-foreground">
                              Vista previa:
                            </span>
                            <div className="w-7 h-7 rounded-full overflow-hidden border">
                              <img
                                src={newIcon}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingKey(null)}
                      >
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit}>
                        Guardar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CategorySettingsModal;
