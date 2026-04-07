import { useState, useMemo, useCallback, memo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import pako from 'pako';
import {
  Home,
  Settings,
  Plus,
  Trash2,
  ShieldCheck,
  Info,
  Languages,
  FileJson,
  Check,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Watch,
  SquareDashed,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Home as HomeIcon,
  User,
  Moon,
  Power,
  Lightbulb,
  Sun,
  Lock,
  Unlock,
  Thermometer,
  Fan,
  Tv,
  Music,
  Bell,
  BellOff,
  Shield,
  Camera,
  Car,
  Coffee,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  Zap,
  CloudRain,
  Snowflake,
  Flame,
  DoorOpen,
  DoorClosed,
  Blinds,
  ArrowUpFromLine,
  ArrowDownToLine,
  Square,
  X,
  Bed,
  Sofa,
  Utensils,
  Bath,
  TreePine,
  Clapperboard,
  Gamepad2,
  Heater,
  AirVent,
  Droplets,
  Sunset,
  Star,
  Heart,
  PartyPopper,
  Siren,
  CircleStop,
  // New icons for Swift parity
  Lamp,
  LampDesk,
  LampFloor,
  LampCeiling,
  Plug,
  ThermometerSun,
  ThermometerSnowflake,
  Wind,
  Cloud,
  ShieldHalf,
  Video,
  Fence,
  AppWindow,
  AppWindowMac,
  Volume1,
  Speaker,
  Airplay,
  Headphones,
  Building2,
  ShowerHead,
  WashingMachine,
  Refrigerator,
  CookingPot,
  Microwave,
  Leaf,
  Cog,
  Clock,
  Timer,
  Sunrise,
  MoonStar,
  MapPin,
  PersonStanding,
  Radio,
  RefreshCw,
  Repeat,
  Bike,
  CircleParking,
  BatteryCharging,
  Waves,
  Paintbrush,
  Wrench,
  ThumbsUp,
  CircleCheck,
  CircleX,
} from 'lucide-react';

// --- Types ---

interface ActionItem {
  label: string;
  icon: string;
  color: string;
  domain: string;
  service: string;
  entityId: string;
  serviceData: string;
  confirm: boolean;
  useLightColor: boolean;
  statusEntityId: string;
  isEmpty: boolean;
}

interface ConfigState {
  haURL: string;
  haToken: string;
  actions: ActionItem[];
}

type Language = 'fr' | 'en';

// --- Constants ---

const COLORS = [
  { name: 'blue', class: 'bg-blue-500', ring: 'ring-blue-500' },
  { name: 'orange', class: 'bg-orange-500', ring: 'ring-orange-500' },
  { name: 'red', class: 'bg-red-500', ring: 'ring-red-500' },
  { name: 'green', class: 'bg-green-500', ring: 'ring-green-500' },
  { name: 'purple', class: 'bg-purple-500', ring: 'ring-purple-500' },
  { name: 'yellow', class: 'bg-yellow-500', ring: 'ring-yellow-500' },
];

const DOMAINS = ['scene', 'script', 'switch', 'light', 'cover', 'automation', 'input_boolean'];

const SERVICES_BY_DOMAIN: Record<string, string[]> = {
  scene: ['turn_on'],
  script: ['turn_on', 'turn_off', 'toggle'],
  switch: ['turn_on', 'turn_off', 'toggle'],
  light: ['turn_on', 'turn_off', 'toggle'],
  cover: ['open_cover', 'close_cover', 'stop_cover', 'toggle'],
  automation: ['turn_on', 'turn_off', 'toggle', 'trigger'],
  input_boolean: ['turn_on', 'turn_off', 'toggle'],
};

const DEFAULT_ACTION: ActionItem = {
  label: '',
  icon: 'house.fill',
  color: 'blue',
  domain: 'scene',
  service: 'turn_on',
  entityId: '',
  serviceData: '',
  confirm: false,
  useLightColor: false,
  statusEntityId: '',
  isEmpty: false,
};

const EMPTY_SLOT: ActionItem = {
  ...DEFAULT_ACTION,
  isEmpty: true,
  label: '',
  icon: '',
  entityId: '',
};

const ACTIONS_PER_PAGE = 4;

const QR_PREFIX = 'HAD1:';

// --- QR Compression (short keys + gzip + base64) ---

const KEY_TO_SHORT: Record<string, string> = {
  haURL: 'u', haToken: 't', actions: 'a',
  label: 'l', icon: 'i', color: 'c', domain: 'd', service: 's',
  entity_id: 'e', service_data: 'sd', status_entity_id: 'se',
  confirm: 'cf', useLightColor: 'lc', empty: 'x',
};

const SHORT_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_SHORT).map(([k, v]) => [v, k])
);

function minifyKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(minifyKeys);
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[KEY_TO_SHORT[k] || k] = minifyKeys(v);
    }
    return result;
  }
  return obj;
}

function expandKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(expandKeys);
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[SHORT_TO_KEY[k] || k] = expandKeys(v);
    }
    return result;
  }
  return obj;
}

function compressForQR(data: Record<string, unknown>): string {
  const minified = minifyKeys(data);
  const json = JSON.stringify(minified);
  const compressed = pako.deflate(new TextEncoder().encode(json));
  const base64 = btoa(String.fromCharCode(...compressed));
  return QR_PREFIX + base64;
}

function decompressFromQR(raw: string): Record<string, unknown> {
  if (raw.startsWith(QR_PREFIX)) {
    const base64 = raw.slice(QR_PREFIX.length);
    const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const decompressed = pako.inflate(binary);
    const json = new TextDecoder().decode(decompressed);
    return expandKeys(JSON.parse(json)) as Record<string, unknown>;
  }
  return JSON.parse(raw);
}

const INITIAL_STATE: ConfigState = {
  haURL: '',
  haToken: '',
  actions: [{ ...DEFAULT_ACTION }],
};

const MAX_ACTIONS = 24; // 6 pages max

// --- Translations ---

const translations = {
  fr: {
    title: "HADash Configurator",
    subtitle: "Configurez vos actions rapides Home Assistant pour Apple Watch.",
    privacyTitle: "Confidentialite garantie",
    privacyDesc: "Toutes les donnees sont traitees localement dans votre navigateur. Rien n'est envoye a un serveur. L'URL et le Token sont optionnels.",
    haTitle: "Connexion Home Assistant (Optionnel)",
    haURL: "URL Home Assistant",
    haToken: "Token d'Acces Longue Duree",
    actionsTitle: "Actions",
    actionLabel: "Libelle",
    actionIcon: "Icone SF Symbol",
    actionColor: "Couleur",
    actionDomain: "Domaine",
    actionService: "Service",
    actionEntityId: "Entity ID",
    actionServiceData: "Donnees supplementaires (JSON)",
    actionConfirm: "Confirmation avant execution",
    actionUseLightColor: "Couleur dynamique (Light)",
    actionStatusEntity: "Entite de statut (optionnel)",
    actionStatusEntityHint: "Affiche l'etat de cette entite sur le bouton (ex: capteur de temperature)",
    placeholderStatusEntity: "sensor.temperature_salon",
    addAction: "Ajouter une action",
    addEmpty: "Ajouter un vide",
    emptySlot: "Emplacement vide",
    page: "Page",
    removeAction: "Supprimer",
    previewTitle: "Votre Configuration QR",
    formatTitle: "Format JSON",
    footer: "HADash Configurator — Actions rapides Home Assistant pour Apple Watch.",
    validationErrorEntity: "Format : 'domaine.nom_entite' (minuscules, chiffres, underscores).",
    validationErrorURL: "L'URL doit commencer par http:// ou https://",
    validationErrorJson: "JSON invalide",
    placeholderHA: "https://votre-ha.duckdns.org",
    placeholderToken: "eyJhbGciOiJIUzI1NiI...",
    placeholderEntity: "scene.arrivee",
    placeholderIcon: "house.fill",
    placeholderServiceData: '{"brightness": 255}',
    importTitle: "Importer un JSON",
    importBtn: "Appliquer le JSON",
    importPlaceholder: "Collez votre JSON ici...",
    importSuccess: "Configuration importee !",
    importError: "JSON invalide ou format incorrect.",
    qrWarning: "Attention : Ce QR Code contient votre Token Home Assistant. Ne le partagez jamais publiquement !",
    maxActions: "Maximum 6 actions",
    iconHint: "Ex: house.fill, person.fill, moon.fill, power",
    action: "Action",
    watchPreview: "Preview Apple Watch",
  },
  en: {
    title: "HADash Configurator",
    subtitle: "Configure your Home Assistant quick actions for Apple Watch.",
    privacyTitle: "Privacy Guaranteed",
    privacyDesc: "All data is processed locally in your browser. Nothing is sent to a server. URL and Token are optional.",
    haTitle: "Home Assistant Connection (Optional)",
    haURL: "Home Assistant URL",
    haToken: "Long-Lived Access Token",
    actionsTitle: "Actions",
    actionLabel: "Label",
    actionIcon: "SF Symbol Icon",
    actionColor: "Color",
    actionDomain: "Domain",
    actionService: "Service",
    actionEntityId: "Entity ID",
    actionServiceData: "Additional Data (JSON)",
    actionConfirm: "Confirm before execution",
    actionUseLightColor: "Dynamic color (Light)",
    actionStatusEntity: "Status entity (optional)",
    actionStatusEntityHint: "Displays this entity's state on the button (e.g., temperature sensor)",
    placeholderStatusEntity: "sensor.living_room_temp",
    addAction: "Add action",
    addEmpty: "Add empty slot",
    emptySlot: "Empty slot",
    page: "Page",
    removeAction: "Remove",
    previewTitle: "Your QR Configuration",
    formatTitle: "JSON Format",
    footer: "HADash Configurator — Home Assistant quick actions for Apple Watch.",
    validationErrorEntity: "Format: 'domain.entity_name' (lowercase, numbers, underscores only).",
    validationErrorURL: "URL must start with http:// or https://",
    validationErrorJson: "Invalid JSON",
    placeholderHA: "https://your-ha.duckdns.org",
    placeholderToken: "eyJhbGciOiJIUzI1NiI...",
    placeholderEntity: "scene.arrival",
    placeholderIcon: "house.fill",
    placeholderServiceData: '{"brightness": 255}',
    importTitle: "Import JSON",
    importBtn: "Apply JSON",
    importPlaceholder: "Paste your JSON here...",
    importSuccess: "Configuration imported!",
    importError: "Invalid JSON or incorrect format.",
    qrWarning: "Warning: This QR Code contains your Home Assistant Token. Never share it publicly!",
    maxActions: "Maximum 6 actions",
    iconHint: "E.g.: house.fill, person.fill, moon.fill, power",
    action: "Action",
    watchPreview: "Apple Watch Preview",
  }
};

// --- SF Symbol to Lucide icon mapping (categorized for picker) ---

interface IconEntry {
  sfName: string;
  icon: LucideIcon;
  category: string;
}

const ICON_CATALOG: IconEntry[] = [
  // Maison
  { sfName: 'house.fill', icon: HomeIcon, category: 'home' },
  { sfName: 'house', icon: HomeIcon, category: 'home' },
  { sfName: 'building.2.fill', icon: Building2, category: 'home' },
  { sfName: 'bed.double.fill', icon: Bed, category: 'home' },
  { sfName: 'bathtub.fill', icon: Bath, category: 'home' },
  { sfName: 'shower.fill', icon: ShowerHead, category: 'home' },
  { sfName: 'sofa.fill', icon: Sofa, category: 'home' },
  { sfName: 'fork.knife', icon: Utensils, category: 'home' },
  { sfName: 'washer.fill', icon: WashingMachine, category: 'home' },
  { sfName: 'dryer.fill', icon: WashingMachine, category: 'home' },
  { sfName: 'refrigerator.fill', icon: Refrigerator, category: 'home' },
  { sfName: 'cooktop.fill', icon: CookingPot, category: 'home' },
  { sfName: 'oven.fill', icon: CookingPot, category: 'home' },
  { sfName: 'microwave.fill', icon: Microwave, category: 'home' },
  { sfName: 'spigot.fill', icon: Droplets, category: 'home' },
  { sfName: 'drop.fill', icon: Droplets, category: 'home' },
  { sfName: 'leaf.fill', icon: Leaf, category: 'home' },
  { sfName: 'tree.fill', icon: TreePine, category: 'home' },
  // Scenes
  { sfName: 'person.fill', icon: User, category: 'scenes' },
  { sfName: 'moon.fill', icon: Moon, category: 'scenes' },
  { sfName: 'sun.max.fill', icon: Sun, category: 'scenes' },
  { sfName: 'sunset.fill', icon: Sunset, category: 'scenes' },
  { sfName: 'star.fill', icon: Star, category: 'scenes' },
  { sfName: 'heart.fill', icon: Heart, category: 'scenes' },
  { sfName: 'party.popper.fill', icon: PartyPopper, category: 'scenes' },
  // Eclairage
  { sfName: 'lightbulb.fill', icon: Lightbulb, category: 'light' },
  { sfName: 'lightbulb', icon: Lightbulb, category: 'light' },
  { sfName: 'lightbulb.min.fill', icon: Lightbulb, category: 'light' },
  { sfName: 'lightbulb.max.fill', icon: Lightbulb, category: 'light' },
  { sfName: 'lamp.desk.fill', icon: LampDesk, category: 'light' },
  { sfName: 'lamp.floor.fill', icon: LampFloor, category: 'light' },
  { sfName: 'lamp.table.fill', icon: Lamp, category: 'light' },
  { sfName: 'lamp.ceiling.fill', icon: LampCeiling, category: 'light' },
  { sfName: 'light.strip.leftright.fill', icon: Lightbulb, category: 'light' },
  { sfName: 'chandelier.fill', icon: Lamp, category: 'light' },
  { sfName: 'light.recessed.fill', icon: Lightbulb, category: 'light' },
  { sfName: 'light.cylindrical.ceiling.fill', icon: Lightbulb, category: 'light' },
  { sfName: 'light.panel.fill', icon: Lightbulb, category: 'light' },
  { sfName: 'display', icon: Tv, category: 'light' },
  { sfName: 'tv.fill', icon: Tv, category: 'light' },
  // Prises & Interrupteurs
  { sfName: 'power', icon: Power, category: 'plugs' },
  { sfName: 'bolt.fill', icon: Zap, category: 'plugs' },
  { sfName: 'powerplug.fill', icon: Plug, category: 'plugs' },
  { sfName: 'switch.2', icon: ToggleLeft, category: 'plugs' },
  { sfName: 'toggle.power', icon: ToggleLeft, category: 'plugs' },
  { sfName: 'poweron', icon: Power, category: 'plugs' },
  { sfName: 'poweroff', icon: Power, category: 'plugs' },
  { sfName: 'outlet.ac.fill', icon: Plug, category: 'plugs' },
  // Portes & Volets
  { sfName: 'door.left.hand.closed', icon: DoorClosed, category: 'doors' },
  { sfName: 'door.left.hand.open', icon: DoorOpen, category: 'doors' },
  { sfName: 'door.garage.closed', icon: DoorClosed, category: 'doors' },
  { sfName: 'door.garage.open', icon: DoorOpen, category: 'doors' },
  { sfName: 'window.vertical.closed', icon: AppWindow, category: 'doors' },
  { sfName: 'window.vertical.open', icon: AppWindowMac, category: 'doors' },
  { sfName: 'blinds.vertical.closed', icon: Blinds, category: 'doors' },
  { sfName: 'blinds.vertical.open', icon: Blinds, category: 'doors' },
  { sfName: 'gate.fill', icon: Fence, category: 'doors' },
  // Volets (controles)
  { sfName: 'arrow.up.to.line', icon: ArrowUpFromLine, category: 'cover' },
  { sfName: 'arrow.down.to.line', icon: ArrowDownToLine, category: 'cover' },
  { sfName: 'stop.fill', icon: CircleStop, category: 'cover' },
  { sfName: 'square.fill', icon: Square, category: 'cover' },
  // Climat
  { sfName: 'thermometer', icon: Thermometer, category: 'climate' },
  { sfName: 'thermometer.medium', icon: Thermometer, category: 'climate' },
  { sfName: 'thermometer.sun.fill', icon: ThermometerSun, category: 'climate' },
  { sfName: 'thermometer.snowflake', icon: ThermometerSnowflake, category: 'climate' },
  { sfName: 'fan.fill', icon: Fan, category: 'climate' },
  { sfName: 'fan', icon: Fan, category: 'climate' },
  { sfName: 'snowflake', icon: Snowflake, category: 'climate' },
  { sfName: 'flame.fill', icon: Flame, category: 'climate' },
  { sfName: 'heater', icon: Heater, category: 'climate' },
  { sfName: 'air.vent', icon: AirVent, category: 'climate' },
  { sfName: 'air.conditioner.horizontal.fill', icon: AirVent, category: 'climate' },
  { sfName: 'humidity.fill', icon: Droplets, category: 'climate' },
  { sfName: 'wind', icon: Wind, category: 'climate' },
  { sfName: 'cloud.fill', icon: Cloud, category: 'climate' },
  { sfName: 'cloud.rain.fill', icon: CloudRain, category: 'climate' },
  // Securite
  { sfName: 'lock.fill', icon: Lock, category: 'security' },
  { sfName: 'lock.open.fill', icon: Unlock, category: 'security' },
  { sfName: 'shield.fill', icon: Shield, category: 'security' },
  { sfName: 'shield.lefthalf.filled', icon: ShieldHalf, category: 'security' },
  { sfName: 'camera.fill', icon: Camera, category: 'security' },
  { sfName: 'video.fill', icon: Video, category: 'security' },
  { sfName: 'web.camera.fill', icon: Camera, category: 'security' },
  { sfName: 'bell.fill', icon: Bell, category: 'security' },
  { sfName: 'bell.slash.fill', icon: BellOff, category: 'security' },
  { sfName: 'eye.fill', icon: Eye, category: 'security' },
  { sfName: 'eye.slash.fill', icon: EyeOff, category: 'security' },
  { sfName: 'exclamationmark.triangle.fill', icon: AlertTriangle, category: 'security' },
  { sfName: 'light.beacon.max.fill', icon: Siren, category: 'security' },
  { sfName: 'sensor.fill', icon: Radio, category: 'security' },
  { sfName: 'sensor.tag.radiowaves.forward.fill', icon: Radio, category: 'security' },
  // Media
  { sfName: 'play.fill', icon: Play, category: 'media' },
  { sfName: 'pause.fill', icon: Pause, category: 'media' },
  { sfName: 'stop.fill', icon: CircleStop, category: 'media' },
  { sfName: 'music.note', icon: Music, category: 'media' },
  { sfName: 'speaker.wave.2.fill', icon: Volume2, category: 'media' },
  { sfName: 'speaker.fill', icon: Volume1, category: 'media' },
  { sfName: 'speaker.slash.fill', icon: VolumeX, category: 'media' },
  { sfName: 'hifispeaker.fill', icon: Speaker, category: 'media' },
  { sfName: 'airplayaudio', icon: Airplay, category: 'media' },
  { sfName: 'headphones', icon: Headphones, category: 'media' },
  { sfName: 'film.fill', icon: Clapperboard, category: 'media' },
  { sfName: 'gamecontroller.fill', icon: Gamepad2, category: 'media' },
  // Automatisation
  { sfName: 'gearshape.fill', icon: Cog, category: 'automation' },
  { sfName: 'gearshape.2.fill', icon: Settings, category: 'automation' },
  { sfName: 'clock.fill', icon: Clock, category: 'automation' },
  { sfName: 'timer', icon: Timer, category: 'automation' },
  { sfName: 'sunrise.fill', icon: Sunrise, category: 'automation' },
  { sfName: 'moon.stars.fill', icon: MoonStar, category: 'automation' },
  { sfName: 'location.fill', icon: MapPin, category: 'automation' },
  { sfName: 'figure.walk', icon: PersonStanding, category: 'automation' },
  { sfName: 'antenna.radiowaves.left.and.right', icon: Radio, category: 'automation' },
  { sfName: 'wifi', icon: Wifi, category: 'automation' },
  { sfName: 'arrow.triangle.2.circlepath', icon: RefreshCw, category: 'automation' },
  { sfName: 'repeat', icon: Repeat, category: 'automation' },
  // Divers
  { sfName: 'car.fill', icon: Car, category: 'other' },
  { sfName: 'bicycle', icon: Bike, category: 'other' },
  { sfName: 'parkingsign', icon: CircleParking, category: 'other' },
  { sfName: 'cup.and.saucer.fill', icon: Coffee, category: 'other' },
  { sfName: 'battery.100.bolt', icon: BatteryCharging, category: 'other' },
  { sfName: 'bolt.batteryblock.fill', icon: BatteryCharging, category: 'other' },
  { sfName: 'water.waves', icon: Waves, category: 'other' },
  { sfName: 'paintbrush.fill', icon: Paintbrush, category: 'other' },
  { sfName: 'wrench.fill', icon: Wrench, category: 'other' },
  { sfName: 'hand.thumbsup.fill', icon: ThumbsUp, category: 'other' },
  { sfName: 'checkmark.circle.fill', icon: CircleCheck, category: 'other' },
  { sfName: 'xmark.circle.fill', icon: CircleX, category: 'other' },
  { sfName: 'wifi.slash', icon: WifiOff, category: 'other' },
  { sfName: 'xmark', icon: X, category: 'other' },
];

const ICON_CATEGORIES: Record<string, { fr: string; en: string }> = {
  home: { fr: 'Maison', en: 'Home' },
  scenes: { fr: 'Scenes', en: 'Scenes' },
  light: { fr: 'Eclairage', en: 'Lighting' },
  plugs: { fr: 'Prises & Interrupteurs', en: 'Plugs & Switches' },
  doors: { fr: 'Portes & Volets', en: 'Doors & Shutters' },
  cover: { fr: 'Volets (controles)', en: 'Cover controls' },
  climate: { fr: 'Climat', en: 'Climate' },
  security: { fr: 'Securite', en: 'Security' },
  media: { fr: 'Media', en: 'Media' },
  automation: { fr: 'Automatisation', en: 'Automation' },
  other: { fr: 'Divers', en: 'Other' },
};

// Build lookup map from catalog
const SF_SYMBOL_MAP: Record<string, LucideIcon> = {};
for (const entry of ICON_CATALOG) {
  SF_SYMBOL_MAP[entry.sfName] = entry.icon;
}
// Aliases for bare SF Symbol names (without .fill) not in the catalog
SF_SYMBOL_MAP['person'] = User;
SF_SYMBOL_MAP['moon'] = Moon;
SF_SYMBOL_MAP['sun.max'] = Sun;
SF_SYMBOL_MAP['sun.min.fill'] = Sun;
SF_SYMBOL_MAP['lock'] = Lock;
SF_SYMBOL_MAP['lock.open'] = Unlock;
SF_SYMBOL_MAP['tv'] = Tv;
SF_SYMBOL_MAP['bell'] = Bell;
SF_SYMBOL_MAP['bell.slash'] = BellOff;
SF_SYMBOL_MAP['shield'] = Shield;
SF_SYMBOL_MAP['camera'] = Camera;
SF_SYMBOL_MAP['car'] = Car;
SF_SYMBOL_MAP['play'] = Play;
SF_SYMBOL_MAP['pause'] = Pause;
SF_SYMBOL_MAP['eye'] = Eye;
SF_SYMBOL_MAP['eye.slash'] = EyeOff;
SF_SYMBOL_MAP['bolt'] = Zap;
SF_SYMBOL_MAP['cloud.rain'] = CloudRain;
SF_SYMBOL_MAP['flame'] = Flame;
SF_SYMBOL_MAP['desktopcomputer'] = Tv;
SF_SYMBOL_MAP['light.max'] = Lightbulb;

function getSfIcon(name: string): LucideIcon {
  return SF_SYMBOL_MAP[name] || HomeIcon;
}

/* eslint-disable react-hooks/static-components -- getSfIcon returns a stable reference from a static map */
function DynamicIcon({ name, ...props }: { name: string } & React.ComponentProps<LucideIcon>) {
  const IconComponent = getSfIcon(name);
  return <IconComponent {...props} />;
}
/* eslint-enable react-hooks/static-components */

// --- Icon Picker Component ---

const IconPicker = memo(({ value, onChange, lang }: { value: string; onChange: (v: string) => void; lang: Language }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const iconsByCategory = useMemo(() => {
    const filtered = search
      ? ICON_CATALOG.filter(e => e.sfName.toLowerCase().includes(search.toLowerCase()))
      : ICON_CATALOG;
    const grouped: Record<string, IconEntry[]> = {};
    for (const icon of filtered) {
      if (!grouped[icon.category]) grouped[icon.category] = [];
      grouped[icon.category].push(icon);
    }
    return grouped;
  }, [search]);

  const categories = useMemo(() => Object.keys(iconsByCategory), [iconsByCategory]);

  return (
    <div className="relative">
      <label>{lang === 'fr' ? 'Icone' : 'Icon'}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-100 hover:border-slate-500 transition-all text-left"
      >
        <DynamicIcon name={value || 'house.fill'} className="w-5 h-5 text-blue-400 shrink-0" strokeWidth={1.5} />
        <span className="flex-1 truncate text-sm">{value || 'house.fill'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-2xl max-h-[360px] overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-2 border-b border-slate-700">
            <input
              type="text"
              placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'}
              className="w-full text-sm !py-1.5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={64}
              autoFocus
            />
          </div>
          {/* Icon grid by category */}
          <div className="overflow-y-auto p-2 space-y-3">
            {categories.map(cat => {
              const icons = iconsByCategory[cat];
              return (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 px-1">
                    {ICON_CATEGORIES[cat]?.[lang] || cat}
                  </p>
                  <div className="grid grid-cols-6 gap-1">
                    {icons.map(entry => {
                      const isSelected = value === entry.sfName;
                      return (
                        <button
                          key={entry.sfName}
                          type="button"
                          onClick={() => { onChange(entry.sfName); setOpen(false); setSearch(''); }}
                          className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all ${
                            isSelected
                              ? 'bg-blue-500/20 ring-1 ring-blue-500'
                              : 'hover:bg-slate-700'
                          }`}
                          title={entry.sfName}
                        >
                          <DynamicIcon name={entry.sfName} className={`w-5 h-5 ${isSelected ? 'text-blue-400' : 'text-slate-300'}`} strokeWidth={1.5} />
                          <span className="text-[7px] text-slate-500 leading-tight truncate w-full text-center">
                            {entry.sfName.split('.')[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

// --- Watch Preview Component ---

const WATCH_COLOR_MAP: Record<string, { border: string; text: string; bg: string }> = {
  blue:   { border: '#3b82f6', text: '#60a5fa', bg: 'rgba(59,130,246,0.15)' },
  orange: { border: '#f97316', text: '#fb923c', bg: 'rgba(249,115,22,0.15)' },
  red:    { border: '#ef4444', text: '#f87171', bg: 'rgba(239,68,68,0.15)' },
  green:  { border: '#22c55e', text: '#4ade80', bg: 'rgba(34,197,94,0.15)' },
  purple: { border: '#a855f7', text: '#c084fc', bg: 'rgba(168,85,247,0.15)' },
  yellow: { border: '#eab308', text: '#facc15', bg: 'rgba(234,179,8,0.15)' },
};

function WatchPreview({ actions, title, lang }: { actions: ActionItem[]; title: string; lang: Language }) {
  const [currentPage, setCurrentPage] = useState(0);

  // Include all actions (including empty slots) for layout
  const allSlots = actions.filter(a => a.isEmpty || a.label.trim() || a.entityId.trim());
  const totalPages = Math.max(1, Math.ceil(allSlots.length / ACTIONS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const pageSlots = allSlots.slice(safePage * ACTIONS_PER_PAGE, (safePage + 1) * ACTIONS_PER_PAGE);

  const t = translations[lang];

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-white text-xl font-bold mb-4 flex items-center gap-2">
        <Watch className="w-5 h-5 text-slate-400" /> {title}
      </h3>
      {/* Watch body */}
      <div className="relative">
        {/* Watch case - outer shell */}
        <div className="relative w-[220px] h-[268px] bg-gradient-to-b from-slate-600 to-slate-700 rounded-[52px] p-[3px] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {/* Digital crown */}
          <div className="absolute -right-[6px] top-[72px] w-[6px] h-[28px] bg-gradient-to-r from-slate-500 to-slate-400 rounded-r-full" />
          <div className="absolute -right-[5px] top-[112px] w-[5px] h-[16px] bg-gradient-to-r from-slate-500 to-slate-400 rounded-r-full" />
          {/* Screen bezel */}
          <div className="w-full h-full bg-black rounded-[50px] p-[8px]">
            {/* Screen */}
            <div className="w-full h-full bg-black rounded-[42px] flex flex-col items-center justify-center overflow-hidden">
              {allSlots.length === 0 ? (
                <p className="text-slate-600 text-xs text-center px-4">No actions configured</p>
              ) : (
                <>
                  <div
                    className="grid gap-[6px] p-3 w-full flex-1 content-center"
                    style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}
                  >
                    {pageSlots.map((action, i) => {
                      if (action.isEmpty) {
                        return (
                          <div
                            key={i}
                            className="rounded-2xl flex items-center justify-center h-[88px] border-2 border-dashed border-slate-700/60"
                          />
                        );
                      }
                      const isDynamicLight = action.useLightColor && action.domain === 'light';
                      const colors = isDynamicLight
                        ? { border: '#fbbf24', text: '#fcd34d', bg: 'rgba(251,191,36,0.15)' }
                        : (WATCH_COLOR_MAP[action.color] || WATCH_COLOR_MAP.blue);
                      const hasStatus = action.statusEntityId?.trim();

                      return (
                        <div
                          key={i}
                          className={`rounded-2xl flex flex-col items-center justify-center relative ${hasStatus ? 'gap-0.5' : 'gap-1.5'} h-[88px] transition-all ${isDynamicLight ? 'shadow-[inset_0_0_12px_rgba(251,191,36,0.1)]' : ''}`}
                          style={{
                            border: isDynamicLight ? '2px dashed #fbbf24' : `2px solid ${colors.border}`,
                            backgroundColor: colors.bg,
                          }}
                        >
                          <DynamicIcon
                            name={action.icon}
                            className="w-6 h-6"
                            style={{ color: colors.text }}
                            strokeWidth={1.5}
                          />
                          {hasStatus && (
                            <span
                              className="text-[9px] font-bold leading-none opacity-90"
                              style={{ color: colors.text }}
                            >
                              --
                            </span>
                          )}
                          <span
                            className="text-[10px] font-medium leading-tight text-center px-0.5"
                            style={{ color: colors.text }}
                          >
                            {action.label || '...'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Page dots */}
                  {totalPages > 1 && (
                    <div className="flex gap-1.5 pb-2">
                      {Array.from({ length: totalPages }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`w-[6px] h-[6px] rounded-full transition-all ${
                            i === safePage ? 'bg-white scale-110' : 'bg-slate-600 hover:bg-slate-500'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Page navigation outside watch */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => setCurrentPage(Math.max(0, safePage - 1))}
            className={`p-1 rounded transition-colors ${safePage === 0 ? 'text-slate-700' : 'text-slate-400 hover:text-white'}`}
            disabled={safePage === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 font-medium">
            {t.page} {safePage + 1}/{totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, safePage + 1))}
            className={`p-1 rounded transition-colors ${safePage === totalPages - 1 ? 'text-slate-700' : 'text-slate-400 hover:text-white'}`}
            disabled={safePage === totalPages - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// --- Validation ---

const isValidEntityId = (id: string) => {
  if (id === '') return true;
  return /^[a-z_]+\.[a-z0-9_]+$/.test(id);
};

const isValidHAUrl = (url: string) => {
  if (url === '') return true;
  return /^https?:\/\/.+$/.test(url);
};

const isValidJson = (str: string) => {
  if (str === '') return true;
  try { JSON.parse(str); return true; } catch { return false; }
};

// --- Components ---

interface InputProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  error?: boolean | string;
  errorMessage?: string;
  hint?: string;
  maxLength?: number;
}

const InputWithError = ({ label, value, onChange, placeholder, type = "text", error, errorMessage, hint, maxLength }: InputProps) => (
  <div>
    <label>{label}</label>
    <input
      type={type}
      placeholder={placeholder}
      className={`w-full ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
      value={value}
      onChange={onChange}
      maxLength={maxLength}
    />
    {hint && !error && <p className="text-slate-500 text-xs mt-1">{hint}</p>}
    {error && <p className="text-red-500 text-xs mt-1">{errorMessage}</p>}
  </div>
);

// --- Main App ---

export default function App() {
  const [config, setConfig] = useState<ConfigState>(INITIAL_STATE);
  const [lang, setLang] = useState<Language>('fr');
  const [importJson, setImportJson] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [expandedActions, setExpandedActions] = useState<Set<number>>(new Set([0]));

  const t = translations[lang];

  // QR data serialization (full JSON for display, compressed for QR)
  const { qrEncoded, qrRawJson, qrStats } = useMemo(() => {
    const output: Record<string, unknown> = {};

    const url = config.haURL.trim();
    const token = config.haToken.trim();
    if (url) output.haURL = url;
    if (token) output.haToken = token;

    output.actions = config.actions
      .filter(a => a.isEmpty || a.label.trim() || a.entityId.trim())
      .map(a => {
        if (a.isEmpty) return { empty: true };
        const action: Record<string, unknown> = {
          label: a.label.trim(),
          icon: a.icon.trim() || 'house.fill',
          color: a.color,
          domain: a.domain,
          service: a.service,
          entity_id: a.entityId.trim(),
        };
        if (a.serviceData.trim()) {
          try { action.service_data = JSON.parse(a.serviceData.trim()); } catch { /* skip invalid */ }
        }
        if (a.statusEntityId.trim()) action.status_entity_id = a.statusEntityId.trim();
        if (a.confirm) action.confirm = true;
        if (a.useLightColor && a.domain === 'light') action.useLightColor = true;
        return action;
      });

    const rawJson = JSON.stringify(output);
    const encoded = compressForQR(output);
    return {
      qrEncoded: encoded,
      qrRawJson: rawJson,
      qrStats: { raw: rawJson.length, compressed: encoded.length, ratio: Math.round((1 - encoded.length / rawJson.length) * 100) },
    };
  }, [config]);

  // Action management
  const updateAction = useCallback((index: number, field: keyof ActionItem, value: string | boolean) => {
    setConfig(prev => {
      const newActions = [...prev.actions];
      newActions[index] = { ...newActions[index], [field]: value };

      // Reset service when domain changes
      if (field === 'domain') {
        const services = SERVICES_BY_DOMAIN[value as string] || ['turn_on'];
        newActions[index].service = services[0];
        if (value !== 'light') {
          newActions[index].useLightColor = false;
        }
      }

      return { ...prev, actions: newActions };
    });
  }, []);

  const addAction = useCallback(() => {
    setConfig(prev => {
      if (prev.actions.length >= MAX_ACTIONS) return prev;
      const newIndex = prev.actions.length;
      setExpandedActions(current => new Set([...current, newIndex]));
      return { ...prev, actions: [...prev.actions, { ...DEFAULT_ACTION }] };
    });
  }, []);

  const addEmptySlot = useCallback(() => {
    setConfig(prev => {
      if (prev.actions.length >= MAX_ACTIONS) return prev;
      return { ...prev, actions: [...prev.actions, { ...EMPTY_SLOT }] };
    });
  }, []);

  const removeAction = useCallback((index: number) => {
    setConfig(prev => {
      const newActions = [...prev.actions];
      newActions.splice(index, 1);
      if (newActions.length === 0) newActions.push({ ...DEFAULT_ACTION });
      return { ...prev, actions: newActions };
    });
    setExpandedActions(prev => {
      const newExpanded = new Set<number>();
      prev.forEach(i => {
        if (i < index) newExpanded.add(i);
        else if (i > index) newExpanded.add(i - 1);
      });
      return newExpanded;
    });
  }, []);

  const toggleExpanded = useCallback((index: number) => {
    setExpandedActions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  }, []);

  const moveAction = useCallback((index: number, direction: -1 | 1) => {
    setConfig(prev => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.actions.length) return prev;
      const newActions = [...prev.actions];
      [newActions[index], newActions[newIndex]] = [newActions[newIndex], newActions[index]];
      return { ...prev, actions: newActions };
    });
    setExpandedActions(prev => {
      const newExpanded = new Set<number>();
      const targetIndex = index + direction;
      prev.forEach(i => {
        if (i === index) newExpanded.add(targetIndex);
        else if (i === targetIndex) newExpanded.add(index);
        else newExpanded.add(i);
      });
      return newExpanded;
    });
  }, []);

  // Import (supports both compressed HAD1: format and raw JSON)
  const handleImport = () => {
    try {
      const trimmed = importJson.trim();
      const parsed = trimmed.startsWith(QR_PREFIX)
        ? decompressFromQR(trimmed) as Record<string, unknown>
        : JSON.parse(trimmed);

      const importedUrl = (parsed.haURL || '').trim();
      if (importedUrl !== '' && !isValidHAUrl(importedUrl)) {
        throw new Error('Invalid URL');
      }

      const actions: ActionItem[] = Array.isArray(parsed.actions)
        ? parsed.actions.map((a: Record<string, unknown>) => {
            if (a.empty) return { ...EMPTY_SLOT };
            return {
              label: String(a.label || ''),
              icon: String(a.icon || 'house.fill'),
              color: String(a.color || 'blue'),
              domain: String(a.domain || 'scene'),
              service: String(a.service || 'turn_on'),
              entityId: String(a.entity_id || a.entityId || ''),
              serviceData: a.service_data ? JSON.stringify(a.service_data) : '',
              confirm: Boolean(a.confirm || a.cf),
              useLightColor: Boolean(a.useLightColor || a.lc),
              statusEntityId: String(a.status_entity_id || a.statusEntityId || ''),
              isEmpty: Boolean(a.empty || a.isEmpty || a.x),
            };
          })
        : [{ ...DEFAULT_ACTION }];

      setConfig({
        haURL: importedUrl,
        haToken: (parsed.haToken || '').trim(),
        actions: actions.length > 0 ? actions.slice(0, MAX_ACTIONS) : [{ ...DEFAULT_ACTION }],
      });
      setExpandedActions(new Set([0]));
      setImportStatus('success');
      setTimeout(() => setImportStatus('idle'), 3000);
    } catch {
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
    }
  };

  // Color for action card border
  const getColorClass = (color: string) => {
    const map: Record<string, string> = {
      blue: 'border-blue-500/50',
      orange: 'border-orange-500/50',
      red: 'border-red-500/50',
      green: 'border-green-500/50',
      purple: 'border-purple-500/50',
      yellow: 'border-yellow-500/50',
    };
    return map[color] || 'border-blue-500/50';
  };

  const getTextColorClass = (color: string) => {
    const map: Record<string, string> = {
      blue: 'text-blue-400',
      orange: 'text-orange-400',
      red: 'text-red-400',
      green: 'text-green-400',
      purple: 'text-purple-400',
      yellow: 'text-yellow-400',
    };
    return map[color] || 'text-blue-400';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left column: Form */}
        <div className="space-y-8">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Home className="text-blue-500 w-8 h-8" />
                {t.title}
              </h1>
              <p className="text-slate-400 mt-2">{t.subtitle}</p>
            </div>
            <button
              onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
              className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium border border-slate-700"
            >
              <Languages className="w-4 h-4" />
              {lang.toUpperCase()}
            </button>
          </div>

          {/* Privacy notice */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 flex gap-3 items-start">
            <ShieldCheck className="text-blue-400 w-6 h-6 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-blue-200">{t.privacyTitle}</p>
              <p className="text-blue-100/70">{t.privacyDesc}</p>
            </div>
          </div>

          <section className="space-y-6">
            {/* HA Connection */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-400" /> {t.haTitle}
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <InputWithError
                  label={t.haURL}
                  placeholder={t.placeholderHA}
                  type="url"
                  value={config.haURL}
                  error={config.haURL !== '' && !isValidHAUrl(config.haURL)}
                  onChange={(e) => setConfig({ ...config, haURL: e.target.value.trim() })}
                  errorMessage={t.validationErrorURL}
                  maxLength={512}
                />
                <InputWithError
                  label={t.haToken}
                  placeholder={t.placeholderToken}
                  type="password"
                  value={config.haToken}
                  onChange={(e) => setConfig({ ...config, haToken: e.target.value.trim() })}
                  errorMessage=""
                  maxLength={2048}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-blue-400">
                  <Home className="w-5 h-5" /> {t.actionsTitle} ({config.actions.length})
                </h2>
                {config.actions.length < MAX_ACTIONS && (
                  <div className="flex gap-2">
                    <button
                      onClick={addEmptySlot}
                      className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 text-slate-400"
                    >
                      <SquareDashed className="w-4 h-4" /> {t.addEmpty}
                    </button>
                    <button
                      onClick={addAction}
                      className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> {t.addAction}
                    </button>
                  </div>
                )}
              </div>

              {config.actions.map((action, index) => (
                <div key={index}>
                  {/* Page separator */}
                  {index > 0 && index % ACTIONS_PER_PAGE === 0 && (
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px bg-slate-700" />
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {t.page} {Math.floor(index / ACTIONS_PER_PAGE) + 1}
                      </span>
                      <div className="flex-1 h-px bg-slate-700" />
                    </div>
                  )}

                  {action.isEmpty ? (
                    /* Empty slot card */
                    <div className="bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-700/50">
                      <div className="flex items-center gap-3 p-4">
                        <div className="flex flex-col gap-0.5 text-slate-600">
                          <button
                            onClick={() => moveAction(index, -1)}
                            className={`hover:text-slate-300 transition-colors ${index === 0 ? 'invisible' : ''}`}
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <GripVertical className="w-3.5 h-3.5" />
                          <button
                            onClick={() => moveAction(index, 1)}
                            className={`hover:text-slate-300 transition-colors ${index === config.actions.length - 1 ? 'invisible' : ''}`}
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-600">
                          <SquareDashed className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-600">{t.emptySlot}</p>
                          <p className="text-slate-700 text-xs">{t.page} {Math.floor(index / ACTIONS_PER_PAGE) + 1}, position {(index % ACTIONS_PER_PAGE) + 1}</p>
                        </div>
                        <button
                          onClick={() => removeAction(index)}
                          className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                  <div
                    className={`bg-slate-800/50 rounded-xl border-2 ${getColorClass(action.color)} transition-all`}
                  >
                  {/* Action header (collapsed view) */}
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer select-none"
                    onClick={() => toggleExpanded(index)}
                  >
                    <div className="flex flex-col gap-0.5 text-slate-600">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveAction(index, -1); }}
                        className={`hover:text-slate-300 transition-colors ${index === 0 ? 'invisible' : ''}`}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <GripVertical className="w-3.5 h-3.5" />
                      <button
                        onClick={(e) => { e.stopPropagation(); moveAction(index, 1); }}
                        className={`hover:text-slate-300 transition-colors ${index === config.actions.length - 1 ? 'invisible' : ''}`}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getColorClass(action.color).replace('/50', '/20')} border ${getColorClass(action.color)}`}>
                      <span className={`text-sm font-bold ${getTextColorClass(action.color)}`}>{index + 1}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${getTextColorClass(action.color)}`}>
                        {action.label || `${t.action} ${index + 1}`}
                      </p>
                      <p className="text-slate-500 text-xs truncate">
                        {action.domain}.{action.service} → {action.entityId || '...'}
                        {action.statusEntityId && (
                          <span className="text-emerald-500/70 ml-1">| status: {action.statusEntityId}</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); removeAction(index); }}
                        className="p-1.5 text-slate-500 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {expandedActions.has(index) ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </div>

                  {/* Action detail (expanded view) */}
                  {expandedActions.has(index) && (
                    <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputWithError
                          label={t.actionLabel}
                          placeholder="Arrivee"
                          value={action.label}
                          onChange={(e) => updateAction(index, 'label', e.target.value)}
                          errorMessage=""
                          maxLength={32}
                        />
                        <IconPicker
                          value={action.icon}
                          onChange={(v) => updateAction(index, 'icon', v)}
                          lang={lang}
                        />
                      </div>

                      {/* Color picker */}
                      <div>
                        <label>{t.actionColor}</label>
                        <div className="flex gap-2 mt-1">
                          {COLORS.map(c => (
                            <button
                              key={c.name}
                              onClick={() => updateAction(index, 'color', c.name)}
                              className={`w-8 h-8 rounded-full ${c.class} transition-all ${
                                action.color === c.name
                                  ? `ring-2 ${c.ring} ring-offset-2 ring-offset-slate-800 scale-110`
                                  : 'opacity-50 hover:opacity-80'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Domain */}
                        <div>
                          <label>{t.actionDomain}</label>
                          <select
                            className="w-full"
                            value={action.domain}
                            onChange={(e) => updateAction(index, 'domain', e.target.value)}
                          >
                            {DOMAINS.map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>

                        {/* Service */}
                        <div>
                          <label>{t.actionService}</label>
                          <select
                            className="w-full"
                            value={action.service}
                            onChange={(e) => updateAction(index, 'service', e.target.value)}
                          >
                            {(SERVICES_BY_DOMAIN[action.domain] || ['turn_on']).map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Entity ID */}
                      <InputWithError
                        label={t.actionEntityId}
                        placeholder={t.placeholderEntity}
                        value={action.entityId}
                        error={action.entityId !== '' && !isValidEntityId(action.entityId)}
                        onChange={(e) => updateAction(index, 'entityId', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                        errorMessage={t.validationErrorEntity}
                        maxLength={128}
                      />

                      {/* Status Entity ID */}
                      <InputWithError
                        label={t.actionStatusEntity}
                        placeholder={t.placeholderStatusEntity}
                        value={action.statusEntityId}
                        error={action.statusEntityId !== '' && !isValidEntityId(action.statusEntityId)}
                        onChange={(e) => updateAction(index, 'statusEntityId', e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                        errorMessage={t.validationErrorEntity}
                        hint={t.actionStatusEntityHint}
                        maxLength={128}
                      />

                      {/* Service Data */}
                      <div>
                        <label>{t.actionServiceData}</label>
                        <input
                          type="text"
                          placeholder={t.placeholderServiceData}
                          className={`w-full ${action.serviceData && !isValidJson(action.serviceData) ? 'border-red-500 focus:ring-red-500' : ''}`}
                          value={action.serviceData}
                          onChange={(e) => updateAction(index, 'serviceData', e.target.value)}
                          maxLength={2048}
                        />
                        {action.serviceData && !isValidJson(action.serviceData) && (
                          <p className="text-red-500 text-xs mt-1">{t.validationErrorJson}</p>
                        )}
                      </div>

                      {/* Confirm toggle */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateAction(index, 'confirm', !action.confirm)}
                          className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {action.confirm ? (
                            <ToggleRight className="w-8 h-8 text-blue-500" />
                          ) : (
                            <ToggleLeft className="w-8 h-8" />
                          )}
                        </button>
                        <span className="text-sm text-slate-400">{t.actionConfirm}</span>
                      </div>

                      {/* Dynamic Color (Light only) */}
                      {action.domain === 'light' && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => updateAction(index, 'useLightColor', !action.useLightColor)}
                            className="text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            {action.useLightColor ? (
                              <ToggleRight className="w-8 h-8 text-yellow-500" />
                            ) : (
                              <ToggleLeft className="w-8 h-8" />
                            )}
                          </button>
                          <span className="text-sm text-slate-400">{t.actionUseLightColor}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right column: Watch preview + QR + import/export */}
        <div className="lg:sticky lg:top-8 space-y-8 h-fit">
          {/* Watch Preview */}
          <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-3xl flex flex-col items-center">
            <WatchPreview actions={config.actions} title={t.watchPreview} lang={lang} />
          </div>

          {/* QR Code */}
          <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl shadow-2xl flex flex-col items-center relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />
            <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />

            <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2 relative">
              {t.previewTitle}
            </h3>

            {config.haToken && (
              <div className="mb-6 bg-red-900/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl flex gap-3 items-center text-sm animate-pulse relative">
                <AlertTriangle className="shrink-0 w-5 h-5 text-red-400" />
                <p className="font-medium leading-tight">{t.qrWarning}</p>
              </div>
            )}

            <div className="relative">
              <div className="absolute -inset-4 bg-blue-500/10 rounded-[2.5rem] blur-2xl" />
              <div className="relative bg-white p-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 transition-transform hover:scale-[1.02] duration-300">
                <QRCodeSVG
                  value={qrEncoded}
                  size={240}
                  level="M"
                  includeMargin={false}
                  fgColor="#1e293b"
                  imageSettings={{
                    src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjM2I4MmY2IiBzdHJva2U9IiMzYjgyZjYiIHN0cm9rZS13aWR0aD0iMSI+PHBhdGggZD0iTTMgOWwzLTNWM2gzTTkgMjFIM3YtM2wtMyAzTTIxIDE1djNoLTNsMyAzTTE1IDNIMTN2M2wzLTMiLz48cGF0aCBkPSJNNyA5aDJ2Mkg3ek05IDdoMnYySDl6TTEzIDloMnYyaC0yek0xNSA3aDJ2MmgtMnpNNyAxM2gydjJIN3pNOSAxNWgydjJIOXpNMTMgMTNoMnYyaC0yek0xNSAxNWgydjJoLTJ6Ii8+PC9zdmc+",
                    height: 40,
                    width: 40,
                    excavate: true,
                  }}
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-1 relative">
              <p className="text-slate-400 text-sm font-medium">HADash configuration</p>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <p className="text-slate-500 text-xs uppercase tracking-widest font-bold">Ready to scan</p>
              </div>
            </div>
          </div>

          {/* Import JSON */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileJson className="w-4 h-4" /> {t.importTitle}
            </h4>
            <textarea
              className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder={t.importPlaceholder}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
            />
            <button
              onClick={handleImport}
              className={`mt-3 w-full font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all ${
                importStatus === 'success' ? 'bg-emerald-600 text-white' :
                importStatus === 'error' ? 'bg-red-600 text-white' :
                'bg-slate-700 hover:bg-slate-600 text-slate-100'
              }`}
            >
              {importStatus === 'idle' && <><FileJson className="w-4 h-4" /> {t.importBtn}</>}
              {importStatus === 'success' && <><Check className="w-4 h-4" /> {t.importSuccess}</>}
              {importStatus === 'error' && <><AlertCircle className="w-4 h-4" /> {t.importError}</>}
            </button>
          </div>

          {/* JSON preview + compression stats */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Info className="w-4 h-4" /> {t.formatTitle}
            </h4>
            <div className="flex gap-3 mb-3 text-xs">
              <span className="bg-slate-700/50 px-2 py-1 rounded text-slate-400">
                JSON: {qrStats.raw} chars
              </span>
              <span className="bg-emerald-900/30 px-2 py-1 rounded text-emerald-400">
                QR: {qrStats.compressed} chars (-{qrStats.ratio}%)
              </span>
              <span className={`px-2 py-1 rounded ${qrStats.compressed > 2000 ? 'bg-red-900/30 text-red-400' : qrStats.compressed > 1500 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-emerald-900/30 text-emerald-400'}`}>
                {qrStats.compressed > 2000 ? 'QR trop dense' : qrStats.compressed > 1500 ? 'Limite haute' : 'OK'}
              </span>
            </div>
            <pre className="text-xs bg-black/40 p-4 rounded-lg overflow-x-auto text-blue-300 font-mono">
              {(() => {
                const displayData = JSON.parse(qrRawJson);
                if (displayData.haToken) displayData.haToken = '••••••••••••••••';
                return JSON.stringify(displayData, null, 2);
              })()}
            </pre>
          </div>
        </div>

      </div>

      <footer className="mt-16 text-center text-slate-500 text-sm">
        <p>{t.footer}</p>
      </footer>
    </div>
  );
}
