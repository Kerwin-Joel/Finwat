import { ArrowUpDown, Filter, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import TransactionItem from "./TransactionItem";
import { SkeletonTransactionItem } from "./SkeletonLoader";
import { Calendar } from "./ui/calendar";
import type {
  Transaction,
  TransactionFilters,
  SortOption,
} from "../types/transaction";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface TransactionListProps {
  transactions: Transaction[];
  isLoading: boolean;
  filters?: TransactionFilters;
  onFilterChange?: (filters: TransactionFilters) => void;
  sortOption?: SortOption;
  onSortChange?: (option: SortOption) => void;
  limit?: number;
  showScrollShadow?: boolean;
  enableAdvancedFilters?: boolean;
  onTransactionClick?: (transaction: Transaction) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  isLoading,
  filters,
  onFilterChange,
  sortOption,
  onSortChange,
  limit,
  showScrollShadow,
  enableAdvancedFilters = false,
  onTransactionClick,
}) => {
  const displayTransactions = limit
    ? transactions.slice(0, limit)
    : transactions;

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center justify-between sticky top-0 bg-background z-10 py-2 transition-all duration-300`}
      >
        <h3 className="text-lg font-semibold tracking-tight px-1">
          Movimientos
        </h3>
        <div className="flex space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 rounded-full text-xs"
              >
                <ArrowUpDown className="h-3 w-3" />
                Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={sortOption === "DATE_DESC"}
                onCheckedChange={() => onSortChange?.("DATE_DESC")}
              >
                Más recientes
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortOption === "AMOUNT_DESC"}
                onCheckedChange={() => onSortChange?.("AMOUNT_DESC")}
              >
                Mayor monto
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={sortOption === "AMOUNT_ASC"}
                onCheckedChange={() => onSortChange?.("AMOUNT_ASC")}
              >
                Menor monto
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {enableAdvancedFilters ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={
                    Object.keys(filters || {}).length > 0
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="h-8 gap-1 rounded-full text-xs"
                >
                  <Filter className="h-3 w-3" />
                  Filtrar
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Tipo</h4>
                    <Select
                      value={filters?.type || "ALL"}
                      onValueChange={(val) =>
                        onFilterChange?.({
                          ...filters,
                          type: val === "ALL" ? undefined : (val as any),
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todos</SelectItem>
                        <SelectItem value="income">Ingresos</SelectItem>
                        <SelectItem value="expense">Gastos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">Categoría</h4>
                    <Select
                      value={filters?.category || "ALL"}
                      onValueChange={(val) =>
                        onFilterChange?.({
                          ...filters,
                          category: val === "ALL" ? undefined : (val as any),
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">Todas</SelectItem>
                        <SelectItem value="SALUD">Salud</SelectItem>
                        <SelectItem value="TRABAJO">Trabajo</SelectItem>
                        <SelectItem value="NEGOCIO">Negocio</SelectItem>
                        <SelectItem value="ALIMENTACION">
                          Alimentación
                        </SelectItem>
                        <SelectItem value="TRANSPORTE">Transporte</SelectItem>
                        <SelectItem value="ENTRETENIMIENTO">
                          Entretenimiento
                        </SelectItem>
                        <SelectItem value="EDUCACION">Educación</SelectItem>
                        <SelectItem value="VIVIENDA">Vivienda</SelectItem>
                        <SelectItem value="SERVICIOS">Servicios</SelectItem>
                        <SelectItem value="OTROS">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">
                      Rango de Fechas
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">
                          Desde
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              size="sm"
                              className={cn(
                                "w-full justify-start text-left font-normal h-8 text-xs",
                                !filters?.startDate && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {filters?.startDate ? (
                                format(new Date(filters.startDate), "P", {
                                  locale: es,
                                })
                              ) : (
                                <span>Seleccionar</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                filters?.startDate
                                  ? new Date(filters.startDate)
                                  : undefined
                              }
                              onSelect={(date) =>
                                onFilterChange?.({
                                  ...filters,
                                  startDate: date
                                    ? date.toISOString()
                                    : undefined,
                                })
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">
                          Hasta
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              size="sm"
                              className={cn(
                                "w-full justify-start text-left font-normal h-8 text-xs",
                                !filters?.endDate && "text-muted-foreground",
                              )}
                            >
                              <CalendarIcon className="mr-2 h-3 w-3" />
                              {filters?.endDate ? (
                                format(new Date(filters.endDate), "P", {
                                  locale: es,
                                })
                              ) : (
                                <span>Seleccionar</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                filters?.endDate
                                  ? new Date(filters.endDate)
                                  : undefined
                              }
                              onSelect={(date) =>
                                onFilterChange?.({
                                  ...filters,
                                  endDate: date
                                    ? date.toISOString()
                                    : undefined,
                                })
                              }
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => onFilterChange?.({})}
                    >
                      Limpiar Filtros
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={
                    Object.keys(filters || {}).length > 0
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="h-8 gap-1 rounded-full text-xs"
                >
                  <Filter className="h-3 w-3" />
                  Filtrar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filtrar por tipo</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filters?.type === undefined}
                  onCheckedChange={() =>
                    onFilterChange?.({ ...filters, type: undefined })
                  }
                >
                  Todos
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters?.type === "income"}
                  onCheckedChange={() =>
                    onFilterChange?.({ ...filters, type: "income" })
                  }
                >
                  Ingresos
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filters?.type === "expense"}
                  onCheckedChange={() =>
                    onFilterChange?.({ ...filters, type: "expense" })
                  }
                >
                  Gastos
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Gradient Shadow */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-background via-background/60 to-transparent translate-y-full pointer-events-none transition-opacity duration-300 ${
            showScrollShadow ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      <div className="space-y-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <SkeletonTransactionItem key={i} />
          ))
        ) : displayTransactions.length > 0 ? (
          displayTransactions.map((transaction, index) => (
            <TransactionItem
              key={transaction.id}
              transaction={transaction}
              index={index}
              onClick={onTransactionClick}
            />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No hay movimientos registrados.
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionList;
