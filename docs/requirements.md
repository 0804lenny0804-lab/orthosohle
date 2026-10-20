# Softwareanforderungen und Produktmeilensteine

Stand: 20.10.2026. **Arbeitsentwurf zur Anforderungsklärung**, keine Freigabe und kein Nachweis einer produktiven/medizinischen Einsatzfähigkeit. Zielauftrag: auf der alten App aufbauen, Frontend und Backend umfassend überarbeiten, Arzt-/Patientenkonten und Sicherheits-/DSGVO-Vorkehrungen ergänzen. Bestätigte Kernentscheidungen stehen in Abschnitt 2; weitere Detailfunktionen unten sind begründete Vorschläge, bis sie abgestimmt sind. Hardwarebasis des eigenständigen Armbands ist auf Nutzerentscheidung Waveshare ESP32-S3-Touch-LCD-1.28; weitere Komponenten, Provider und Frameworkänderungen sind nicht ausgewählt.

## 1. Was „produktreif“ hier konkret bedeutet

Das Ziel ist ein betreibbares Gesamtsystem mit sicheren, nachvollziehbaren Nutzerabläufen und belegten Grenzen. Ein schönes Dashboard, vorhandene Datenbank oder erfolgreicher Build allein genügt nicht. Zu unterscheiden sind technische Abnahme, datenschutzrechtliche Betriebsfähigkeit und die fachlich/regulatorisch erforderliche Freigabe für den beabsichtigten medizinischen Einsatz.

**Bestätigt durch Nutzerauftrag:** alte App als funktionale Basis, umfassende Überarbeitung, Arzt und Patient mit jeweils eigenen Funktionen, vollständiges Frontend/Backend, Sicherheit und Datenschutz als Produktanforderungen. Die lokale unabhängige Warnkette bleibt aus dem bisherigen Projektrahmen maßgeblich.

**Einsatzfolge bestätigt:** beaufsichtigter Pilot zuerst, regulärer Einsatz nach erforderlicher Freigabe. Ein Pilot ist keine pauschale Ausnahme von Sicherheits-, Datenschutz- oder sonstigen anwendbaren Voraussetzungen. **Noch festzulegen:** Verantwortlicher/Betreiber, konkretes Pilotsetting, Zielmärkte, vorgesehene Nutzer, klinischer Zweck und Aussagen zur Verlässlichkeit. EU-MDR-Einordnung, einschlägige Entwicklungs-/Risikomanagementanforderungen und notwendige Nachweise fachlich bestimmen; keine Klasse/Zulassung ohne Prüfung behaupten. Echte Gesundheitsdaten oder Patientenbetrieb erst nach den dafür erforderlichen Freigaben.

Der alte 300/600-Stunden-Plan bleibt als bisherige Semesterplanung erhalten. Das zusätzliche Ärzteportal und die vollständige Betriebs-/Freigabearbeit sind darin **nicht belastbar geschätzt**. Für das neue Produktziel Umfang und Aufwand neu schätzen; weder ein marktreifes System noch dessen medizinische Freigabe für den 28.01.2027 zusagen. Semesterlieferung und anschließende Produktfreigabe nach der Klärung ausdrücklich zuordnen.

## 2. Bestätigte Kernentscheidungen und offene Abgrenzung

Vom Nutzer am 20.10.2026 bestätigt:

| Frage | Verbindliche Entscheidung | Konsequenz |
|---|---|---|
| Arzt-/Patientenzuordnung | Patient bestätigt Einladung eines geprüften Arztes | Arztprüfung vor Einladung; explizite Beziehungsaktivierung statt Zugriff allein durch Kenntnis einer E-Mail |
| Medizinische Belastungsgrenze | Arzt legt fest, Patient sieht und bestätigt die Geräteübernahme | Patient kann medizinischen Wert nicht frei überschreiben; jede Änderung mit Autor/Version |
| Erste Smartphoneplattformen | iPhone und Android | Datenweg auf beiden Plattformen nachweisen; Web-Bluetooth allein nicht als allgemeine Lösung voraussetzen |
| Zusätzlicher Watch-Client | Apple Watch von Beginn an mitplanen; iPhone, Android, Waveshare und Apple Watch laut Nutzer verfügbar | Apple Watch zuerst real testen; Modelle/OS und zugesagte Funktionen klären; kein macOS-Zugang, AltServer installiert, Apple-Buildweg noch zu organisieren; Wear OS später |
| Erste Einsatzform | Beaufsichtigter Pilot, regulärer Einsatz erst nach Freigabe | Pilotumfang, Betreuung und eigene Abnahme definieren |
| Behandlerzahl | Genau ein verantwortlicher Arzt pro Patient; Arztwechsel unterstützt | Keine gleichzeitig gleichberechtigten Behandler in Version 1; Zuständigkeitswechsel historisieren |
| Lokaler Messdatenweg | Sohle schickt Messwerte an das Handy | Diesen BLE-Pfad für beide Smartphoneplattformen prüfen; Backend-Übertragung ist ein zweiter Schritt |
| Eigenständiges Armband | Waveshare ESP32-S3-Touch-LCD-1.28 als Hardwarebasis | Eigene Firmware für Anzeige/lokale Warnung; exakte Revision, Akku/Ladung, Haptik und BLE-Pfad noch nachweisen |

Patientenbestätigung und technische Gerätebestätigung unterscheiden: Die App darf einen Plan erst als am Armband angewendet anzeigen, wenn das tatsächliche Gerät die richtige Version bestätigt. Eine Benutzeraktion allein reicht nicht. Verhalten bei ausstehender Bestätigung oder abgelaufenem Plan muss festgelegt werden.

**Arztwechsel:** Neue Betreuung erst nach definiertem Einladungs-/Bestätigungsablauf aktivieren, alten Zugriff nach Regel beenden und zu jedem Zeitpunkt höchstens einen verantwortlichen Arzt führen. Historischen Plan samt Autor erhalten; Entscheidung über weitere Gültigkeit des Plans während des Wechsels ausdrücklich treffen. Keine ungefragte Übernahme alter ärztlicher Zugriffsrechte.

**Datenweg auseinanderhalten:** Sohle → Handy (lokaler Empfang per BLE) ist der bestätigte Ausgangspunkt. Handy → Backend (Internetübertragung) ermöglicht gespeicherte Sitzungen und Arztzugriff. Offen ist, wann dieser zweite Schritt passiert: während aktiver App, zusätzlich im Hintergrund oder nach Offlinephasen. Eine Offline-Queue auf dem Handy kann nur bereits empfangene Daten sichern; Messungen ohne BLE-Empfänger benötigen Speicher am Messgerät/Armband oder müssen als Lücke kenntlich bleiben. Keinen Gerätepuffer aus der früheren Frage als beschlossen ableiten.

**Unabhängiges Armband:** Der bestätigte Handyempfang hebt die bisherige lokale Warnanforderung nicht auf. Direkter Armbandempfang, Parallelverbindung oder anderer lokaler Pfad sind weiterhin nachzuweisen. Das Waveshare-Gerät ist jetzt als Hardwarebasis des unabhängigen Warnarmbands bestätigt. Zusätzliche gängige Smartwatches stehen im [Arbeitsbereich WATCH](watch-compatibility.md); nicht ungeprüft Sohle → Handy → Uhr als autonome Warnkette ausgeben. Ein ESP32-Board mit Touchdisplay ist kein Nachweis von Motor, Akku, fertigem Gehäuse oder zuverlässiger Warnfunktion.

Weitere offene Fragen: konkrete Arztprüfung, Zugriffs-/Aufbewahrungsregeln nach Arztwechsel, gültiger Plan während des Wechsels, Uploadzeitpunkt, Offlinedauer/Puffergrenzen, Geräteteilung, Praxismodell, Hostingbudget und Support.

## 3. Vorgeschlagene Kernabläufe

**Patient:** Konto erstellen/verifizieren → Betreuung zuordnen → Gerät verbinden → gültigen Therapieplan und tatsächlich angewendete Grenze prüfen → Messsitzung mit lokalem Armband durchführen → Upload-/Fehlerstatus sehen → eigene Verläufe nachvollziehen → Daten exportieren oder Datenschutzanfrage stellen.

**Arzt:** Berechtigung bestätigen → anmelden → bestätigte Patientenbeziehungen sehen → Patient öffnen → Plan/Grenze mit Gültigkeit festlegen → Übernahmezustand am Gerät erkennen → zugeordnete Verläufe und Qualitätsgrenzen auswerten → Betreuung beenden bzw. freigegebenen Bericht erstellen.

**Betrieb:** Dienste bereitstellen → Monitoring/Backups prüfen → Störungen bearbeiten → Konten/Geräte sicher sperren → Wiederherstellung und Datenschutzanfragen nach dokumentierten Abläufen durchführen. Kein vollständiges Adminportal oder Nachrichtensystem auf Vorrat; nötige Betriebsfunktionen können zunächst abgesicherte Werkzeuge sein.

## 4. Rollen und Zugriff – vorgeschlagene Regeln

| Fähigkeit | Patient | Arzt |
|---|---|---|
| Eigenes Konto/Profil verwalten | Ja | Ja |
| Eigene Messdaten ansehen/exportieren | Ja | Nur wenn selbst betroffene Person in einem ausdrücklich unterstützten Ablauf |
| Fremde Messdaten ansehen/exportieren | Nein | Nur bei erlaubter aktiver Beziehung und passendem Zweck |
| Medizinischen Plan festlegen | Nein; nur Anzeige und Bestätigung | Ja, für ausdrücklich zugeordnete Patienten |
| Geräte verbinden/Upload auslösen | Eigene zugewiesene Geräte | Gerätestatus zugeordneter Patienten lesen; Änderung nur nach definiertem Ablauf |
| Beziehungen freigeben/beenden | Nach vereinbartem Betreuungsmodell | Nach vereinbartem Betreuungsmodell |
| Sich selbst Arzt-/Adminrechte geben | Nein | Nein |

Technischer Betrieb hat standardmäßig keinen fachlichen Zugriff auf Patientenverläufe. Falls ein besonderer Supportzugriff nötig ist: zeitlich begrenzt, autorisiert und protokolliert. Eine etwaige Aufbewahrung ärztlicher Unterlagen ist vom normalen Plattformzugriff nach Beziehungsende gesondert zu bestimmen. Rollen allein reichen nicht: Eigentum, Beziehung, Zweck und Freigabestatus auf dem Server prüfen.

## 5. Funktionale Anforderungen und Abnahme

Alle IDs sind Produktanforderungen, **keine bereits implementierten Funktionen**. „Kern“ bezeichnet den vorgeschlagenen Umfang der ersten produktiven Version; ausstehende Modellentscheidungen können ihn verändern. Bestätigte Rollen-/Plan-/Plattformvorgaben gelten bereits. Nicht in den alten Backlog einrechnen, bevor Umfang und Schätzung aktualisiert wurden.

| ID | Bereich | Kernanforderung | Konkrete Abnahme |
|---|---|---|---|
| ACC-01 | Konten | Registrierung, E-Mail-Verifikation, Login/Logout, Passwortreset mit bewährter Auth-Lösung | Abgelaufener/erneut verwendeter Reset-Link scheitert; Logout beendet serverseitig den Zugang |
| ACC-02 | Rollen | Serverseitige Rollenprüfung; Arztzugang erst nach definiertem Nachweis/Einladung | Patient kann weder per UI noch direktem HTTP-Aufruf Arzt werden; ungeprüftes Arztkonto kann keine Betreuungseinladung versenden |
| ACC-03 | Sitzungen | Sichere Session, erneute Authentifizierung für sensible Änderungen, Sitzungen widerrufen | Gestohlene/alte Session nach Widerruf unbrauchbar; kein Health-API-Zugriff ohne gültige Session |
| ACC-04 | Schutz | MFA für Arztkonten, gesicherte Wiederherstellung, Login-/Reset-Ratenbegrenzung | MFA-Verlust hat nachvollziehbaren Recoveryweg ohne Umgehung der Identitätsprüfung |
| REL-01 | Betreuung | Einladungen mit Ablauf/Einmalnutzung, ausdrückliche Zuordnung und Liste aktiver Beziehungen | Einladung kann nicht mehrfach oder von falscher Identität übernommen werden |
| REL-02 | Betreuung | Datenzugriff nur für erlaubte Beziehung; Beendigung/Sperrung nachvollziehbar | Arzt A erhält nie Daten von Patient B ohne zulässige Zuordnung; Entzug greift serverseitig einschließlich vorhandener Sessions |
| REL-03 | Arztwechsel | Höchstens ein verantwortlicher Arzt; Wechsel nachvollziehbar und ohne Rechteübernahme | Gleichzeitige/erneute Einladungsannahmen schaffen keine zwei aktiven Verantwortlichen; alter Zugriff und Plangültigkeit nach festgelegtem Wechselmodell geprüft |
| PAT-01 | Patient | Startansicht mit Plan, bestätigter Grenze, Geräte-/Uploadstatus und eindeutigen Hinweisen | Kein Gerät/keine Daten erscheint nicht als 0 kg oder „alles sicher“ |
| PAT-02 | Patient | Eigene Sitzungen, Verlauf, Überschreitungen, Qualität und Feedback | Eine eigene Sitzung lässt sich nach erneutem Login samt Verlauf wieder öffnen |
| DOC-01 | Arzt | Patientenübersicht mit Suche und Betreuungsstatus | Keine global durchsuchbare Patientenliste; Suchergebnisse auf erlaubte Beziehungen beschränkt |
| DOC-02 | Arzt | Patientenansicht mit Planhistorie, Sitzungen und Messqualität | Zeitfilter, fehlende Messabschnitte und Überbereich sind sichtbar; keine erfundene Vollständigkeit |
| PLN-01 | Plan | Versionierter Belastungsplan: Grenzwert, Einheit, Autor, Erstellzeit, Gültigkeit und Änderungshistorie | Historische Sitzung bewertet nach damals wirksamem Plan, nicht nach aktuellem Grenzwert |
| PLN-02 | Synchronisierung | Sollwert und angewendeter Gerätewert mit Bestätigung/Version trennen | Fehlende/abgebrochene Übertragung zeigt „ausstehend“, nie „angewendet“ |
| PLN-03 | Ausfall | Verhalten bei unbekanntem/abgelaufenem Plan und Offline-Konflikt festlegen | Geräte-/App-Neustart und Offline-Änderung führen zu dokumentiertem Zustand; keine stille Grenzwertänderung |
| DEV-01 | Geräte | Gerät anhand stabiler Identität zuordnen, benennen, entfernen; Verlust/Wechsel behandeln | Fremdes oder bereits zugeordnetes Gerät kann nicht allein über erratene ID übernommen werden |
| DEV-02 | Gerätestatus | Verbindung, letzter Kontakt, Akku, Firmware und Messqualität soweit unterstützt | Nicht verfügbare Hardwareinformation wird als unbekannt statt erfunden angezeigt |
| DEV-03 | Wechsel | Sichere Übergabe/Zurücksetzung mit Löschung alter Bindungen und verbleibender lokaler Daten | Neu zugeordneter Patient erhält keine Daten oder Konfiguration des vorherigen Nutzers |
| DAT-01 | Messformat | Version, Einheit, Wertebereich, Sequenz, Geräte-/Empfangszeit, Qualitäts-/Überbereichsstatus | Kurze Pakete, NaN, Replay und unsupported Versionen werden definiert behandelt |
| DAT-02 | Messsitzung | Nutzer, Gerät, Zeitbasis, wirksame Planversion, Quelle real/demo und Qualitätsstatus speichern | Ein Datenpunkt ist eindeutig zuordenbar; Testdaten verändern keine echten Therapieverläufe |
| DAT-03 | Upload | Gewählter Gateway unterstützt gepufferten, authentifizierten und idempotenten Upload | Abbruch/Wiederholung erzeugt keinen Datenverlust innerhalb der zugesagten Puffergrenze und keine Duplikate |
| DAT-04 | Zeit/Verlauf | Datenlücken, Zeitzonen/Sommerzeit und Uhrabweichungen behandeln | Ein Tag/Sitzungsintervall wird reproduzierbar ausgewertet; Gerätezeit nicht als echte UTC ausgeben |
| ALT-01 | Warnkette | Belastungswarnung lokal am Armband, einschließlich Datenalter, Hysterese und Fehlerzustand | Ohne Internet/Telefon reproduzierbare Warnung und Störungsanzeige gemäß festgelegten Grenzen |
| ALT-02 | Appmeldungen | Lokalen Alarm, Apphinweis und entfernte Benachrichtigung unterscheiden | Verzögerter Upload wird nicht als Echtzeitalarm dargestellt; kein unbegründetes Versprechen ärztlicher Dauerüberwachung |
| HIS-01 | Auswertung | Verlauf und nachvollziehbare Grenzüberschreitungen pro Sitzung und Zeitraum | Werte unter 12 kg werden nicht weggefiltert; keine bloße Ausreißerstatistik als Überschreitungszahl |
| HIS-02 | Berichte | Personenbezogener Datenexport und bei Bedarf nachvollziehbare Verlaufsausgabe | Autorisierte Daten mit Einheit, Zeit, Qualität, Planbezug und Exportzeit; kein Export fremder Daten |
| UX-01 | Frontend | Eigene Patienten-/Arztbereiche, responsive Oberfläche, verständliche Erstinbetriebnahme | Rollenabhängige Hauptabläufe am Zielgerät vollständig durchführbar; URL-Wechsel umgeht keine Rechte |
| UX-02 | Zugänglichkeit | Tastaturbedienung, Labels, verständliche Fehler, ausreichend Kontrast; Status nicht nur farblich | Kernabläufe mit Tastatur und Screenreader prüfbar; Zahlen/Einheiten und Zustand eindeutig |
| UX-03 | Zustände | Laden, leer, offline, gesperrt, fehlgeschlagen und veraltet sichtbar | Backendausfall zeigt keine scheinbar erfolgreiche Änderung oder aktuelle Livezahl |
| WAT-01 | Watch-Anbindung | Apple-Watch-Client und Handy-Kommunikation ab M0/M1 berücksichtigen; fachlichen Umfang in WATCH klären | Früher Test auf echter gekoppelter Uhr mit kg, Planversion und Datenalter; Telefon-/Hintergrundabhängigkeit nachgewiesen und sichtbar |

## 6. Backend und Datenmodell – fachlicher Bedarf, noch keine Stackwahl

Vorhandene Vue-/Express-Bausteine und Domänenwissen prüfen und gezielt weiterverwenden. Die neue Oberfläche kann vollständig überarbeitet werden; keine pauschale 1:1-Übernahme des alten App.vue und keine parallele unabhängige Implementierung gleicher Fachregeln. Migration und Verhaltenskorrekturen nachvollziehbar trennen. Datenbank-/Auth-/Hostingauswahl erst an Anforderungen und Betriebsaufwand messen; SQLite nicht reflexartig ersetzen oder ungeprüft für Mehrinstanzbetrieb voraussetzen.

Benötigte fachliche Datentypen: Konto/Identität; Arztprofil und Prüfstatus; Patient; Betreuungsbeziehung mit Freigabestatus; Gerät und zeitliche Zuordnung; Planversion und Gerätebestätigung; Messsitzung; Messpunkte/verdichtete Ereignisse mit Qualität; Auditereignisse; Datenschutzanfrage. Das sind Verantwortlichkeiten, noch keine verpflichtenden elf Tabellen/Services. Aufbewahrung und Indizes nach Zugriff/Volumen bestimmen.

API muss Eingaben und Rechte serverseitig prüfen, einheitliche Fehler liefern, Listen begrenzen/paginieren, Transaktionen verwenden und Schemaänderungen reproduzierbar migrieren. Clientseitige Rollenanzeigen und CORS sind kein Zugriffsschutz. Alte unzugeordnete Daten nur über dokumentierte Migration mit überprüfter Zuordnung übernehmen, niemals pauschal an ein neu angelegtes Konto hängen.

**Abnahme:** Zwei Patienten und zwei Ärzte mit verschiedenen Beziehungen; sämtliche Lese-/Schreib-/Export-/Geräterouten einschließlich erratener IDs gegeneinander getestet. Datenmigration und Rücksicherung auf Testdaten nachgewiesen. Kontenlöschung/Betreuungsende behandelt verknüpfte Datentypen nach dem festgelegten Aufbewahrungsmodell.

## 7. Sicherheit – vor produktiver Nutzung erforderlich

| ID | Anforderung | Nachweis |
|---|---|---|
| SEC-01 | TLS, sichere Session-/Cookieeinstellungen und Schutz gegen CSRF bei Cookieauth; XSS-/Injection-Schutz | Geprüfte Konfiguration und gezielte Angriffstests auf relevante Eingänge |
| SEC-02 | MFA/Recovery, rollen- und beziehungsbezogene Autorisierung, minimaler Zugriff | Negative Tests für jeden sensiblen Endpunkt, kein Zugriff durch bloße Rollen-/ID-Manipulation |
| SEC-03 | Secrets getrennt, Least-Privilege-Dienstkonten, verschlüsselte Datenhaltung/Backups und kontrollierte Schlüsselverwaltung | Deploymentreview; keine Schlüssel im Client/Repo; Wiederherstellung mit kontrolliertem Schlüsselzugriff |
| SEC-04 | Sicherheits-/Änderungsaudit mit Zeit, Akteur, Aktion und betroffenem Datensatz; Schutz vor unbemerkter Veränderung | Plan-, Rollen-, Geräte- und Zugriffsänderungen nachvollziehbar; nicht mit beliebigem Nutzerdaten-Update löschbar |
| SEC-05 | Keine Tokens, Passwörter oder unnötigen Gesundheitswerte in Logs, Analytics, URLs und Push-Nachrichten | Prüfung von Fehlerfällen, Telemetrie und Benachrichtigungsvorschauen |
| SEC-06 | Abhängigkeitsinventar, automatisierte relevante Checks, Updates und unabhängige Sicherheitsprüfung vor Freigabe | Keine offenen kritischen/hohen Befunde ohne dokumentierte vertretbare Behandlung; Zuständigkeit für Updates benannt |
| SEC-07 | Gerätebindung, Wiederholungs-/Fremddatenschutz und autorisierte Konfiguration auf Gerätepfad prüfen | Fremder BLE-/Uploadclient kann keinen Patientenstrom oder Grenzwert unbemerkt ersetzen |

Risikoanalyse umfasst Kontoübernahme, falsche Zuordnung, verspätete/fehlende Warnung, falsche Einheit, Überbereich, veralteten Plan, Verlust/Diebstahl und Offlinekonflikte. Warnpfad, Gateway und Backend als zusammenhängende Vertrauenskette prüfen. Ende-zu-Ende-Verschlüsselung ist keine automatische DSGVO-Bedingung und muss mit ärztlicher Auswertung/Betrieb vereinbar konzipiert werden; keine unbelegte Werbeaussage.

## 8. Datenschutz und Betrieb von Gesundheitsdaten

Gesundheitsdaten brauchen neben einer Grundlage nach Art. 6 DSGVO eine passende Ausnahme nach Art. 9. Die konkrete Grundlage, Verantwortlichkeiten und Informationspflichten fachlich prüfen. „Patient klickt Einwilligung“ ist keine pauschale Lösung; Betreuungszuordnung, datenschutzrechtliche Einwilligung und technische Zugriffsfreigabe unterscheiden.

| ID | Anforderung | Abnahme / zu klärender Punkt |
|---|---|---|
| PRI-01 | Zweck, Verantwortlicher, Auftragsverarbeiter, Rechtsgrundlage und Datenflüsse dokumentieren | Vollständige Übersicht der tatsächlich verwendeten Dienste und Unterauftragsverarbeiter |
| PRI-02 | Datenminimierung und verständliche Datenschutzinformation vor Datenerhebung | Nur begründete Profil-/Messfelder; Versionsstand der Information nachvollziehbar |
| PRI-03 | Hostingregion, Drittlandtransfers, AV-Verträge und Schlüssel-/Supportzugriff prüfen | EU-Hosting allein wird nicht als DSGVO-Nachweis behandelt; Voraussetzungen der eingesetzten Dienste geklärt |
| PRI-04 | Aufbewahrung, Auskunft, Berichtigung, Export, Einschränkung, Löschung und ggf. Widerruf umsetzen | Identitätsgeprüfter Anfrageprozess; Patient kann eigene Daten erhalten; nicht aufbewahrungspflichtige Daten nach Regel löschen |
| PRI-05 | Löschung vs. Dokumentationspflicht/Audit/Backup behandeln | Kein pauschales Löschversprechen; Fristen/Restriktionen benannt, gelöschte Daten erscheinen nach Restore nicht unkontrolliert wieder |
| PRI-06 | Technisch notwendige Speicherung von Tracking trennen; keine unnötigen Drittanbieter/Health-Analytics | Ohne optionale Einwilligung keine optionale Telemetrie; Abmeldung/Gerätewechsel entfernt lokale Gesundheitscaches nach Konzept |
| PRI-07 | Verzeichnis der Verarbeitungstätigkeiten, TOM und Erforderlichkeit einer DSFA prüfen; Incidentprozess festlegen | Zuständige Personen und Verfahren für Datenschutzvorfälle/Betroffenenrechte benannt; anwendbare Fristen erfasst |

Keine echten Patienten-/Identitätsdaten in Entwicklungsfixtures oder Git. Test- und Produktivumgebungen strikt trennen. Ärztlicher Zugriff nach Betreuungsende, Minderjährige/Vertretung, gemeinsame Geräte und Praxiswechsel sind vor Unterstützung jeweils gesondert festzulegen; keine stillschweigenden Sonderrechte.

## 9. Nichtfunktionale Anforderungen und Betrieb

Vor Architektur-/Releaseentscheidung messbare Zielwerte vereinbaren, statt Zahlen als vorhandene Leistung zu behaupten:

| Bereich | Vor Umsetzung festzulegen | Nachweis |
|---|---|---|
| Warnkette | Maximal erlaubtes Messwertalter, Warnlatenz, Paketverlustrate und Ausfallreaktion | Messung an echter Hardware, auch ohne Internet/Telefon; keine Ableitung allein aus delay(200) |
| Datenpuffer | Maximale Offlinedauer/Datenmenge und Verhalten bei vollem Speicher | Abbruch-/Neustarttests; Datenverlust/Überlauf sichtbar |
| Dashboard | Zielgeräte/-browser, Aktualisierungsdefinition und tolerierte Antwortzeiten | Messung mit realistisch langen Verläufen, Loading-/Stale-Zuständen |
| Kapazität | Anzahl Konten/Geräte, parallele Sitzungen, Abtastrate, Speicherfristen | Last-/Volumentest und Speicherkostenabschätzung |
| Verfügbarkeit | Servicezeiten, Monitoring, Supportreaktion, Wartungsfenster | Betriebsablauf und überwachte Dienste; Armband bleibt lokal unabhängig |
| Wiederherstellung | Maximale tolerierte Datenlücke (RPO) und Ausfalldauer (RTO) | Regelmäßiger Restore in isolierter Umgebung; dokumentierter letzter Nachweis |
| Auslieferung | Reproduzierbarer Build, Migration, Rollback, Staging und Konfigurationsprüfung | Release ohne manuelle geheime Einzelschritte; getesteter Rückweg ohne unbemerkten Datenverlust |
| Wartung | Verantwortliche für Support, Sicherheitsupdates, Backups und Vorfälle | Benannte Zuständigkeiten; keine alleinige Abhängigkeit von einem Chat/Gerät |

Grundlegende UI-Abnahme orientiert sich vorgeschlagen an WCAG 2.2 AA für Kernabläufe; konkrete rechtliche Anwendbarkeit gesondert prüfen. Installierbare PWA bedeutet weder native iOS-BLE-Unterstützung noch gesicherten Hintergrundbetrieb. Für iPhone/Android ggf. nativen Gatewaybedarf früh experimentell klären, bevor UI und Datenmodell auf einen nicht verfügbaren Weg bauen.

## 10. Meilensteine mit nachweisbaren Ausgängen

Die Reihenfolge ist eine Arbeitsstruktur, **keine terminierte/geschätzte Zusage**. Nach den Kernentscheidungen Umfang, echte Personenstunden und Semesterlieferung bestimmen. M3–M5 dürfen nach abgesichertem Grundmodell teilweise parallel laufen; End-to-End früh in M1 zeigen, einschließlich eines kleinen Apple-Watch-Durchstichs nach Verfügbarkeit der Buildumgebung. In noch nicht freigegebenen Umgebungen nur synthetische Daten.

| Meilenstein | Ergebnis | Abnahme und Abhängigkeit |
|---|---|---|
| M0 – Ziel und Rechte verbindlich | Einsatzgrenze, Rollen, Betreuung, Planhoheit, Plattformen, Datenverantwortung und Kernumfang entschieden | Antworten/Entscheidungen dokumentiert, kritische Risiken und messbare Zielwerte benannt; Grundlage aller weiteren Pakete |
| M1 – Technische Machbarkeit und früher Durchstich | Bestätigten Pfad Sohle → Handy auf iPhone/Android sowie unabhängigen Armbandpfad prüfen und alte App abgleichen; Apple-Watch-Companion früh erproben | Gültig/stale/Überbereich sowie Plan-ACK demonstriert; Apple Watch erhält Testdaten mit Alter/Planversion; derzeit fehlenden Apple-Buildzugang als Blocker führen, ohne ihn als bestandene Teilabnahme auszugeben; M0 vorausgesetzt |
| M2 – Sichere Konten und Betreuungsrechte | Registrierung/Login/Reset/MFA, Arztprüfung, Einladung, Zuordnung und Entzug | Zwei Ärzte/zwei Patienten gegeneinander getestet, keine Rechteeskalation; M0 und gewählte Auth-Integration |
| M3 – Versionierter Plan und Gerätebindung | Pläne, Historie, Gerätebesitz und bestätigte Grenzwertübernahme | Offline-/Neustart-/Entzugs-/Wechselfälle geprüft; keine falsche Erfolgsmeldung; M1/M2 |
| M4 – Geschützter Sitzungsdatenweg | Schema/Migration, Upload, Puffer/Retry, Sitzung/Planbezug und Audit | Echte Testsession erneut abrufbar, Duplikate/Lücken/Zeitzonen geprüft, Restore erster Datenbasis; M1/M2 und Planvertrag aus M3 |
| M5 – Patienten- und Ärzteoberfläche | Vollständige Kernabläufe für beide Rollen, mobile und zugängliche Darstellung; zugesagte Apple-Watch-Funktionen abgestimmt integrieren | Onboarding bis Verlauf/Export pro Rolle durchführbar; Fehler-/Leerezustände geprüft; M2–M4 |
| M6 – Datenschutz und Produktionsbetrieb | Rechte-/Löschprozesse, Verträge/Informationen, getrennte Umgebungen, Monitoring/Backup/Updateablauf | Verantwortlichkeiten benannt, Restore und Incidentübung, Datenschutzreview; kontinuierlich ab M0 vorbereiten, M2–M5 für Ende-zu-Ende-Abnahme |
| M7 – Gesamtabnahme | Funktion, Sicherheitsreview, Last-/Bedien-/Hardwaretests und dokumentierte Grenzen | Kritische Befunde geschlossen oder Freigabe blockiert, Rückverfolgbarkeit Anforderung → Test → Ergebnis; M1–M6 |
| M8 – Einsatzfreigabe | Zuerst Freigabe für den definierten beaufsichtigten Pilot; spätere reguläre Freigabe getrennt | Erforderliche fachliche/regulatorische und Datenschutz-/Betriebsnachweise für den jeweiligen Einsatz liegen vor; technische Fertigstellung allein reicht nicht; M7 |

Hausarbeit/Media Night bleiben eigene Semesterlieferungen mit früh laufender Belegsammlung und klar markiertem Testdaten-Fallback. Welcher Meilenstein bis Semesterende belastbar erreichbar ist, nach Aufwandsschätzung entscheiden. Apple-Watch-Kompatibilität wird im eigenen [Arbeitsbereich WATCH](watch-compatibility.md) von Beginn an mit der App geplant und früh erprobt; zugesagter Funktionsumfang, Aufwand und unterstützte Modelle sind noch festzulegen. Wear OS ist eine spätere Erweiterung, derzeit ohne genannte Testuhr. Das Waveshare-Armband bleibt dagegen Hauptprojekt und höchste Priorität. KI-Auswertung, Chat, Terminplanung, Abrechnung und automatische Therapieempfehlungen nur bei explizitem Folgeauftrag und belegtem Bedarf ergänzen.

## 11. So wird daraus ein umsetzbarer Backlog

Nach Klärung der noch offenen Punkte aus Abschnitt 2: M0 konkret abschließen, Architekturspikes abgrenzen, dann pro Meilenstein vertikale Aufgaben von ca. 2–4 echten Personenstunden schneiden. Jede Aufgabe referenziert Anforderungs-ID, Abnahme, benötigte Daten/Hardware, Abhängigkeiten und Prüfnachweis. Sinnvolles Beispiel: „ACC-01: Passwortreset mit abgelaufenem Token testen und implementieren“, nicht „gesamte Auth bauen“.

Den bestehenden Backlog nicht kommentarlos auf das neue Ziel umdeuten oder die alte 180-Personenstunden-Appschätzung als ausreichend ausgeben. Erst neue Aufgaben schätzen, gemeinsame Überschneidungen zusammenführen, dann Budget-/Umfangsentscheidung dokumentieren und den Backlog aktualisieren. Dieses Dokument ist die eine maßgebliche Produktspezifikation; keine zusätzliche parallele Anforderungstabelle erzeugen.
