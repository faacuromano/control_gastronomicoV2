# Documentación de API: Registro y Autenticación

Este documento detalla los endpoints necesarios para implementar las pantallas de Registro (Sign Up) y Alta de Usuarios.

---

## 1. Registro de Nuevo Restaurante (SaaS Sign Up)

**Endpoint Principal** para la Landing Page o pantalla de "Crear Cuenta".
Este endpoint crea un nuevo Tenant (Restaurante), configura los roles por defecto y crea al usuario Administrador.

- **URL**: `/api/auth/signup`
- **Método**: `POST`
- **Acceso**: Público

### Datos Requeridos (Request Body)

| Campo          | Tipo   | Requerido | Validación          | Descripción                                                                           |
| :------------- | :----- | :-------- | :------------------ | :------------------------------------------------------------------------------------ |
| `businessName` | String | Sí        | Mínimo 2 caracteres | Nombre del Restaurante (ej. "La Trattoria"). Se usará para generar el código interno. |
| `name`         | String | Sí        | Mínimo 1 caracter   | Nombre completo del dueño/administrador (ej. "Juan Pérez").                           |
| `email`        | String | Sí        | Email válido        | Correo electrónico para el login. Debe ser único.                                     |
| `password`     | String | Sí        | Mínimo 6 caracteres | Contraseña segura.                                                                    |
| `phone`        | String | No        | -                   | Teléfono de contacto (opcional).                                                      |

### Ejemplo de Solicitud (JSON)

```json
{
  "businessName": "Burger King Sucursal 1",
  "name": "Admin Usuario",
  "email": "admin@burgerking.com",
  "password": "password123",
  "phone": "+5491112345678"
}
```

### Respuesta Exitosa (201 Created)

```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": 1,
      "name": "Burger King Sucursal 1",
      "activeSubscription": true
    },
    "user": {
      "id": 1,
      "name": "Admin Usuario",
      "email": "admin@burgerking.com",
      "generatedPin": "123456" // PIN de respaldo generado automáticamente
    },
    "message": "Tenant registered successfully"
  }
}
```

> **Nota para Diseño (UI/UX)**:
>
> - Mostrar feedback visual de carga.
> - Mostrar el `generatedPin` al usuario tras el registro exitoso como una "Credencial de Respaldo" importante.
> - Redirigir al Dashboard principal automáticamente (la sesión se inicia sola vía Cookies).

---

## 2. Alta de Usuario Interno (Empleado)

**Endpoint Interno** para el panel de administración (`/admin/users`).
Permite a un administrador crear nuevos empleados (Mozos, Cocineros, etc.) dentro de su restaurante.

- **URL**: `/api/auth/register` (Nota: Debería moverse a `/api/users` en futuras versiones, pero actualmente está aquí).
- **Método**: `POST`
- **Acceso**: Privado (Requiere Token de Admin)

### Datos Requeridos (Request Body)

| Campo      | Tipo   | Requerido | Validación            | Descripción                                                                              |
| :--------- | :----- | :-------- | :-------------------- | :--------------------------------------------------------------------------------------- |
| `name`     | String | Sí        | Mínimo 1 caracter     | Nombre del empleado.                                                                     |
| `email`    | String | Sí        | Email válido          | Correo del empleado.                                                                     |
| `password` | String | Sí        | Mínimo 6 caracteres   | Contraseña del empleado.                                                                 |
| `pinCode`  | String | Sí        | Exactamente 6 dígitos | PIN para acceso rápido (POS/Tablet).                                                     |
| `roleId`   | Number | Sí        | ID válido             | ID del rol (ej. 2 para Mozo, 3 para Cocina). Obtener lista de `/api/roles`.              |
| `tenantId` | Number | Sí        | ID válido             | ID del Tenant actual (generalmente inyectado por el frontend desde la sesión del admin). |

### Ejemplo de Solicitud (JSON)

```json
{
  "name": "Carlos Mozo",
  "email": "carlos@burgerking.com",
  "password": "user123",
  "pinCode": "555555",
  "roleId": 2, // ID de Rol 'Waiter'
  "tenantId": 1
}
```

### Respuesta Exitosa (201 Created)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 5,
      "name": "Carlos Mozo",
      "role": "WAITER",
      "permissions": { ... }
    },
    "message": "Registration successful"
  }
}
```

---

## Notas Generales de Diseño

1.  **Validación en Tiempo Real**: Validar formato de email y longitud de password mientras el usuario escribe.
2.  **Manejo de Errores**:
    - Si el email ya existe: Mostrar mensaje claro ("Este correo ya está registrado").
    - Error 400 (Bad Request): Revisar campos obligatorios.
    - Error 500: "Ocurrió un error en el servidor, intente más tarde".
