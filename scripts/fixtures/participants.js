/**
 * Test fixtures only.
 *
 * These are NOT application data. The app draws exclusively from the signed-in
 * IB's real ByteFX clients; there is deliberately no demo pool for it to fall
 * back to when the API fails. This file exists so `npm run verify` can exercise
 * the reel maths, the filters and the masking against a fixed, fully populated
 * set of records without needing a live ByteFX session.
 */

/** Square, face-cropped Unsplash portrait at the size the cards actually use. */
const photo = (id) =>
  `https://images.unsplash.com/photo-${id}?w=160&h=160&fit=crop&crop=faces&auto=format&q=75`;

// A handful of participants deliberately have no photo. Those fall back to the
// default user icon, which is the same thing that happens if an image 404s.
export const participants = [
  { id: "usr_10293", name: "Pratik Patil",      avatar: photo("1507003211169-0a1dd7228f2d"), region: "India",          clientId: "8420418", email: "pratik.patil@mail.com",  netDeposit: 189,  lots: 2.06,  isFunded: true,  wonBefore: false },
  { id: "usr_10318", name: "Amara Okonkwo",     avatar: photo("1573496359142-b8d87734a5a2"), region: "Nigeria",        clientId: "5119370", email: "amara.o@mail.com",       netDeposit: 1240, lots: 14.80, isFunded: true,  wonBefore: false },
  { id: "usr_10344", name: "Lucas Ferreira",    avatar: photo("1500648767791-00dcc994a43e"), region: "Brazil",         clientId: "7730164", email: "lucas.f@mail.com",       netDeposit: 76,   lots: 0.94,  isFunded: false, wonBefore: false },
  { id: "usr_10361", name: "Sofia Ricci",       avatar: photo("1494790108377-be9c29b29330"), region: "Italy",          clientId: "2648805", email: "sofia.ricci@mail.com",   netDeposit: 3120, lots: 41.20, isFunded: true,  wonBefore: true  },
  { id: "usr_10389", name: "Daniel Ncube",      avatar: null,                                region: "South Africa",   clientId: "9033521", email: "d.ncube@mail.com",       netDeposit: 452,  lots: 6.35,  isFunded: true,  wonBefore: false },
  { id: "usr_10402", name: "Mei Lin Chen",      avatar: photo("1534528741775-53994a69daeb"), region: "Singapore",      clientId: "6471288", email: "meilin.c@mail.com",      netDeposit: 2075, lots: 22.40, isFunded: true,  wonBefore: false },
  { id: "usr_10437", name: "Omar Haddad",       avatar: photo("1506794778202-cad84cf45f1d"), region: "UAE",            clientId: "3805942", email: "omar.haddad@mail.com",   netDeposit: 890,  lots: 9.10,  isFunded: true,  wonBefore: false },
  { id: "usr_10455", name: "Elena Volkova",     avatar: photo("1517841905240-472988babdf9"), region: "Kazakhstan",     clientId: "1592047", email: "e.volkova@mail.com",     netDeposit: 128,  lots: 1.55,  isFunded: false, wonBefore: false },
  { id: "usr_10478", name: "James Whitmore",    avatar: photo("1472099645785-5658abf4ff4e"), region: "United Kingdom", clientId: "4460913", email: "j.whitmore@mail.com",    netDeposit: 1680, lots: 18.75, isFunded: true,  wonBefore: true  },
  { id: "usr_10496", name: "Ana Sofia Rojas",   avatar: photo("1502685104226-ee32379fefbe"), region: "Colombia",       clientId: "8817264", email: "ana.rojas@mail.com",     netDeposit: 305,  lots: 3.80,  isFunded: true,  wonBefore: false },
  { id: "usr_10513", name: "Rahul Menon",       avatar: null,                                region: "India",          clientId: "2204778", email: "rahul.menon@mail.com",   netDeposit: 64,   lots: 0.42,  isFunded: false, wonBefore: false },
  { id: "usr_10540", name: "Yuki Tanaka",       avatar: photo("1438761681033-6461ffad8d80"), region: "Japan",          clientId: "7326105", email: "yuki.tanaka@mail.com",   netDeposit: 4210, lots: 37.60, isFunded: true,  wonBefore: false },
  { id: "usr_10566", name: "Chidi Balogun",     avatar: photo("1521119989659-a83eee488004"), region: "Nigeria",        clientId: "9948612", email: "chidi.b@mail.com",       netDeposit: 720,  lots: 8.05,  isFunded: true,  wonBefore: false },
  { id: "usr_10581", name: "Marta Kowalski",    avatar: photo("1544005313-94ddf0286df2"),    region: "Poland",         clientId: "5573390", email: "m.kowalski@mail.com",    netDeposit: 244,  lots: 2.90,  isFunded: true,  wonBefore: false },
  { id: "usr_10604", name: "Tariq Rahman",      avatar: photo("1519345182560-3f2917c472ef"), region: "Bangladesh",     clientId: "3061847", email: "tariq.r@mail.com",       netDeposit: 98,   lots: 1.20,  isFunded: false, wonBefore: false },
  { id: "usr_10629", name: "Isabella Moreau",   avatar: photo("1487412720507-e7ab37603c6f"), region: "France",         clientId: "6690253", email: "i.moreau@mail.com",      netDeposit: 1975, lots: 24.15, isFunded: true,  wonBefore: true  },
  { id: "usr_10647", name: "Kwame Asante",      avatar: photo("1546525848-3ce03ca516f6"),    region: "Ghana",          clientId: "1148936", email: "kwame.a@mail.com",       netDeposit: 530,  lots: 5.60,  isFunded: true,  wonBefore: false },
  { id: "usr_10672", name: "Nguyen Bao Tran",   avatar: null,                                region: "Vietnam",        clientId: "8235471", email: "baotran.n@mail.com",     netDeposit: 366,  lots: 4.45,  isFunded: true,  wonBefore: false },
  { id: "usr_10698", name: "Diego Salazar",     avatar: photo("1529626455594-4ff0802cfb7e"), region: "Mexico",         clientId: "4407719", email: "diego.s@mail.com",       netDeposit: 152,  lots: 1.85,  isFunded: false, wonBefore: false },
  { id: "usr_10715", name: "Priya Deshmukh",    avatar: photo("1524504388940-b1c1722653e1"), region: "India",          clientId: "7752084", email: "priya.d@mail.com",       netDeposit: 2680, lots: 29.30, isFunded: true,  wonBefore: false },
  { id: "usr_10733", name: "Andreas Lindqvist", avatar: photo("1463453091185-61582044d556"), region: "Sweden",         clientId: "2916640", email: "a.lindqvist@mail.com",   netDeposit: 1105, lots: 12.05, isFunded: true,  wonBefore: false },
  { id: "usr_10759", name: "Fatima Al-Zahra",   avatar: photo("1499996860823-5214fcc65f8f"), region: "Egypt",          clientId: "6084357", email: "fatima.az@mail.com",     netDeposit: 415,  lots: 5.10,  isFunded: true,  wonBefore: false },
  { id: "usr_10776", name: "Carlos Mendes",     avatar: photo("1508214751196-bcfd4ca60f91"), region: "Portugal",       clientId: "3378902", email: "c.mendes@mail.com",      netDeposit: 58,   lots: 0.68,  isFunded: false, wonBefore: false },
  { id: "usr_10794", name: "Hannah Berger",     avatar: photo("1573497019940-1c28c88b4f3e"), region: "Germany",        clientId: "9520138", email: "h.berger@mail.com",      netDeposit: 1530, lots: 16.90, isFunded: true,  wonBefore: true  },
  { id: "usr_10812", name: "Ibrahim Coulibaly", avatar: null,                                region: "Ivory Coast",    clientId: "5245786", email: "ibrahim.c@mail.com",     netDeposit: 640,  lots: 7.25,  isFunded: true,  wonBefore: false },
  { id: "usr_10839", name: "Saoirse ODonnell",  avatar: photo("1580489944761-15a19d654956"), region: "Ireland",        clientId: "1863024", email: "s.odonnell@mail.com",    netDeposit: 285,  lots: 3.35,  isFunded: true,  wonBefore: false },
  { id: "usr_10857", name: "Viktor Petrov",     avatar: photo("1599566150163-29194dcaad36"), region: "Bulgaria",       clientId: "7091459", email: "v.petrov@mail.com",      netDeposit: 3480, lots: 33.70, isFunded: true,  wonBefore: false },
  { id: "usr_10874", name: "Ayesha Siddiqui",   avatar: photo("1607746882042-944635dfe10e"), region: "Pakistan",       clientId: "4638215", email: "ayesha.s@mail.com",      netDeposit: 172,  lots: 2.15,  isFunded: false, wonBefore: false },
  { id: "usr_10896", name: "Thabo Molefe",      avatar: photo("1568602471122-7832951cc4c5"), region: "South Africa",   clientId: "8974603", email: "thabo.m@mail.com",       netDeposit: 925,  lots: 10.40, isFunded: true,  wonBefore: false },
  { id: "usr_10918", name: "Camila Duarte",     avatar: photo("1580618672591-eb180b1a973f"), region: "Argentina",      clientId: "2507861", email: "camila.d@mail.com",      netDeposit: 1360, lots: 15.55, isFunded: true,  wonBefore: false },
  { id: "usr_10935", name: "Ethan Brooks",      avatar: null,                                region: "Canada",         clientId: "6712398", email: "ethan.brooks@mail.com",  netDeposit: 815,  lots: 9.85,  isFunded: true,  wonBefore: true  },
  { id: "usr_10952", name: "Leila Karimi",      avatar: photo("1541823709867-1b206113eafd"), region: "Turkey",         clientId: "3159047", email: "leila.k@mail.com",       netDeposit: 2240, lots: 26.60, isFunded: true,  wonBefore: false },
];

export default participants;
