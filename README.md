# prenotami

Bot para reservar turnos en sedes de la embajada de italiana.

El bot necesita acceso a la cuenta de gmail con la que se esta
registrado en prenotami para buscar automaticamente el OTP de
la reserva. Es **importante** no tener mails de prenotami con el asunto
_OTP code_ sin leer para que funcione el OTP automático.

## Antes de correr el bot

1. Entrar a google cloud https://console.cloud.google.com/apis/credentials
2. Crear un nuevo proyecto
3. Click **Create Credentials** > **OAuth client ID**.
4. Click **Application type** > **Desktop app**.
5. Descargar el JSON de credenciales y guardarlo en la carpeta tokens en un archivo llamado credentials.json

## Configuracion

Crear archivo .env y cargar las siguientes variables

-   USER: email usado en https://prenotami.esteri.it/
-   PASS: contraseña usado en https://prenotami.esteri.it/
-   SERVICE: id del servicio al que quiere solicitar el turno

    1. Entrar a: https://prenotami.esteri.it/Services
    2. El id del servicio es numero en la url del boton "reservar"

-   WAIT_BEFORE_BOOKING: Cuanto tiempo esperar antes de iniciar la reserva. Util si se hace login un tiempo antes de que esten disponibles los turnos
-   START_BOOKING_RETRY: Cuantas veces vamos a reintentar iniciar una reserva
-   WAIT_PER_BOOK_RETRY: Tiempo de espera en ms entre reintentos de reserva
-   MONTHS_TO_SCRAPE: Cantidad de meses a partir del actual en el que vamos a buscar turnos
-   RETRY_PER_MONTH: Cantidad de reintentos por mes
-   WAIT_PER_MONTH_RETRY: Tiempo de espera entre reintentos de cada mes consultado
-   HEADLESS: Si se inicia puppeeter en modo headless o no

## Instalar dependencias

`npm install`

# Ejecutar el bot

`npm run start`
