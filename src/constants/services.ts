import type { FinancialService } from '../types/service';

export const MOCK_SERVICES: FinancialService[] = [
  {
    id: "svc-001",
    category: "SCORE_CREDITICIO",
    title: "Consulta de Score Crediticio",
    description: "Conoce tu puntaje crediticio actualizado y aplica estrategias para mejorar.",
    longDescription:
      "Obtén un reporte detallado de tu historial crediticio. Incluye puntaje actual, factores que lo afectan, recomendaciones para mejorar tu score y comparación con el promedio nacional. Útil antes de solicitar créditos o préstamos.",
    icon: "📈",
    price: 20,
    currency: "PEN",
    status: "DISPONIBLE",
    estimatedTime: "1 hora",
    requirements: ["DNI vigente", "Número de celular verificado"],
    tags: ["Gratuito", "Inmediato", "Crédito"],
    rating: 4.8,
    reviewCount: 1243,
  },
  {
    id: "svc-002",
    category: "COMPRA_DIVISAS",
    title: "Cambista",
    description:
      "Compra dólares, soles a tasas competitivas y resguarda tus ahorros.",
    longDescription:
      "Compra monedas extranjeras desde tu cuenta sin salir de casa. Tasas actualizadas en tiempo real, sin comisiones ocultas. Soporta USD, EUR, GBP y BRL. El monto se descuenta automáticamente de tu cuenta en Soles.",
    icon: "💱",
    price: undefined,
    currency: "PEN",
    status: "DISPONIBLE",
    estimatedTime: "30 minutos",
    requirements: [
      "Cuenta activa con saldo suficiente",
      "Identidad verificada",
    ],
    tags: ["Tiempo real", "Sin comisiones", "Multi-divisa"],
    rating: 4.5,
    reviewCount: 876,
    comingSoon: true,
  },
  {
    id: "svc-004",
    category: "ASESOR_FINANCIERO",
    title: "Asesoría Financiera",
    description: "Habla con un asesor financiero vía WhatsApp.",
    longDescription:
      "Conecta directamente con un asesor financiero certificado a través de WhatsApp. Recibe orientación personalizada sobre ahorro, inversión, manejo de deudas y planificación financiera. Sesiones de 30 minutos disponibles lunes a viernes.",
    icon: "🤝",
    price: undefined,
    currency: "PEN",
    status: "DISPONIBLE",
    estimatedTime: "30 minutos",
    requirements: ["Número de WhatsApp verificado", "Pago previa a la sesión"],
    tags: ["Personalizado", "Certificado", "WhatsApp"],
    rating: 4.9,
    reviewCount: 432,
    comingSoon: true,
  },
];
