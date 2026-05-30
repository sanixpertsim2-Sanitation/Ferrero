-- =============================================================================
-- SaniExpert Seed Data: MACY Checklist Templates (53 Items)
-- =============================================================================
-- This script seeds:
--   1. Client: SaniExpert
--   2. Facility: Main Plant
--   3. Production Line: MACY
--   4. 5 Areas (MACY Production, MACY Decoration, MACY Oven, MACY Spiral, MACY Palletizing)
--   5. 53 Checklist Templates across all 5 areas
--
-- Item counts per area:
--   MACY Production    : 19 items (3 pre-cleaning + 16 post-cleaning)
--   MACY Decoration    : 17 items (3 pre-cleaning + 14 post-cleaning)
--   MACY Oven          :  4 items (1 pre-cleaning +  3 post-cleaning)
--   MACY Spiral        :  5 items (1 pre-cleaning +  4 post-cleaning)
--   MACY Palletizing   :  8 items (1 pre-cleaning +  7 post-cleaning)
-- =============================================================================

-- =============================================================================
-- STEP 1: Seed Client
-- =============================================================================
INSERT INTO clients (name, contact_email, contact_phone)
VALUES ('SaniExpert', 'contact@sanisolutions.ca', '+1-514-555-0100')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- STEP 2: Seed Facility
-- =============================================================================
INSERT INTO facilities (client_id, name, address)
SELECT id, 'Main Plant', '1800 Industrial Blvd, Montreal, QC H4X 1A1'
FROM clients WHERE name = 'SaniExpert'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- STEP 3: Seed Production Line
-- =============================================================================
INSERT INTO production_lines (facility_id, name, status)
SELECT id, 'MACY', 'RAW'
FROM facilities WHERE name = 'Main Plant'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- STEP 4: Seed 5 MACY Areas
-- =============================================================================
INSERT INTO areas (line_id, name, sequence_order, status)
SELECT id, area_data.name, area_data.ord, 'RAW'
FROM production_lines
CROSS JOIN LATERAL (
    VALUES
        ('MACY Production',  1),
        ('MACY Decoration',  2),
        ('MACY Oven',        3),
        ('MACY Spiral',      4),
        ('MACY Palletizing', 5)
) AS area_data(name, ord)
WHERE production_lines.name = 'MACY'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- STEP 5: Seed 53 Checklist Templates
-- =============================================================================

-- ---------------------------------------------------------------------------
-- AREA 1: MACY Production — 19 items (3 pre-cleaning + 16 post-cleaning)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_area_id UUID;
BEGIN
    SELECT id INTO v_area_id FROM areas WHERE name = 'MACY Production';

    IF v_area_id IS NOT NULL THEN
        -- PRE-CLEANING (3 items)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'pre-cleaning', 'How many pieces of equipment have been covered?', 'count', 1, true, 'equipment_covered',
             'Count all mixers, conveyors, hoppers, and other production equipment that have been covered with plastic to protect from water and chemicals.'),
            (v_area_id, 'pre-cleaning', 'How many bags of garbage have been retrieved from the production floor?', 'count', 2, true, 'bags_retrieved',
             'Count full garbage bags removed from production area including ingredient waste, packaging scrap, and floor debris.'),
            (v_area_id, 'pre-cleaning', 'Are all electrical components, control panels, and motors properly covered with waterproof protection?', 'yes_no', 3, false, NULL,
             'Verify all electrical boxes, MCC panels, motor housings, and sensors are sealed with plastic covers or waterproof bags.');

        -- POST-CLEANING (16 items)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'post-cleaning', 'Are all production floors completely free of debris, water puddles, and chemical residue?', 'yes_no', 4, false, NULL,
             'Inspect entire floor surface for any remaining food particles, standing water, or foam residue.'),
            (v_area_id, 'post-cleaning', 'Are all walls and columns in the production area clean and free of splatter and buildup?', 'yes_no', 5, false, NULL,
             'Check walls, support columns, and partition panels for any chemical or food splatter.'),
            (v_area_id, 'post-cleaning', 'Are all overhead structures, catwalks, and platforms free of dust and debris?', 'yes_no', 6, false, NULL,
             'Inspect overhead pipes, catwalks, platforms, and ceiling-mounted equipment for accumulated dust.'),
            (v_area_id, 'post-cleaning', 'Are all mixing bowls and agitators clean and free of product residue?', 'yes_no', 7, false, NULL,
             'Inspect interior and exterior surfaces of all mixing equipment for complete removal of dough or batter residue.'),
            (v_area_id, 'post-cleaning', 'Are all conveyor belts, chains, and sprockets clean and free of buildup?', 'yes_no', 8, false, NULL,
             'Check belt surfaces, chain drives, sprockets, and tensioners for product buildup or grease accumulation.'),
            (v_area_id, 'post-cleaning', 'Are all product transfer chutes and hoppers completely clean?', 'yes_no', 9, false, NULL,
             'Inspect all chutes, hoppers, and drop tubes for complete removal of product material.'),
            (v_area_id, 'post-cleaning', 'Are all floor drains clean, free-flowing, and free of debris?', 'yes_no', 10, false, NULL,
             'Check drain grates, catch basins, and drain lines for obstructions or accumulated waste.'),
            (v_area_id, 'post-cleaning', 'Are all equipment motors and gearboxes free of excessive grease and oil?', 'yes_no', 11, false, NULL,
             'Inspect motor housings, gearbox casings, and drive units for grease leaks or accumulated lubricant.'),
            (v_area_id, 'post-cleaning', 'Are all safety guards and protective covers properly reinstalled on equipment?', 'yes_no', 12, false, NULL,
             'Verify all belt guards, chain guards, and safety covers are back in place after cleaning.'),
            (v_area_id, 'post-cleaning', 'Are all cleaning tools and chemical containers removed from the production area?', 'yes_no', 13, false, NULL,
             'Ensure no brooms, squeegees, chemical totes, or cleaning equipment remains on the production floor.'),
            (v_area_id, 'post-cleaning', 'Are all overhead pipes and utility lines free of condensation and leaks?', 'yes_no', 14, false, NULL,
             'Check compressed air lines, steam pipes, and electrical conduits for condensation or visible leaks.'),
            (v_area_id, 'post-cleaning', 'Is the general lighting adequate and are all light fixtures clean?', 'yes_no', 15, false, NULL,
             'Verify all production area lights are functioning and fixture covers are free of dust and buildup.'),
            (v_area_id, 'post-cleaning', 'Are all equipment covers and access panels properly secured?', 'yes_no', 16, false, NULL,
             'Check that all equipment doors, inspection hatches, and access panels are closed and latched.'),
            (v_area_id, 'post-cleaning', 'Photo: Overall production floor cleanliness after sanitation', 'photo', 17, false, NULL,
             'Take a wide-angle photo showing the overall condition of the production floor post-cleaning.'),
            (v_area_id, 'post-cleaning', 'Photo: Clean mixing equipment and transfer points', 'photo', 18, false, NULL,
             'Take photos of key mixing equipment and product transfer points to verify cleanliness.'),
            (v_area_id, 'post-cleaning', 'Photo: Clean floor drains and surrounding area', 'photo', 19, false, NULL,
             'Take photos of floor drains and surrounding floor area to verify proper cleaning.');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- AREA 2: MACY Decoration — 17 items (3 pre-cleaning + 14 post-cleaning)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_area_id UUID;
BEGIN
    SELECT id INTO v_area_id FROM areas WHERE name = 'MACY Decoration';

    IF v_area_id IS NOT NULL THEN
        -- PRE-CLEANING (3 items)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'pre-cleaning', 'How many pieces of decoration equipment have been covered?', 'count', 1, true, 'equipment_covered',
             'Count all enrobers, depositors, sprinklers, and decoration stations that have been covered for protection.'),
            (v_area_id, 'pre-cleaning', 'How many bags of topping and decoration waste have been retrieved?', 'count', 2, true, 'bags_retrieved',
             'Count bags of waste including excess sprinkles, chocolate chips, nuts, and other decoration materials.'),
            (v_area_id, 'pre-cleaning', 'Are all electrical controls for decoration lines properly covered?', 'yes_no', 3, false, NULL,
             'Verify control panels, sensors, and servo motors for decoration equipment are sealed against water ingress.');

        -- POST-CLEANING (14 items)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'post-cleaning', 'Are all enrobing machines and chocolate kettles completely clean?', 'yes_no', 4, false, NULL,
             'Inspect chocolate enrobers, melting kettles, and tempering units for complete removal of chocolate residue.'),
            (v_area_id, 'post-cleaning', 'Are all topping depositors and sprinklers free of product buildup?', 'yes_no', 5, false, NULL,
             'Check depositor nozzles, sprinkle drums, and topping applicators for clogs or residue buildup.'),
            (v_area_id, 'post-cleaning', 'Are all decoration conveyor belts and cooling tunnels clean?', 'yes_no', 6, false, NULL,
             'Inspect decoration line belts, cooling tunnel conveyors, and transfer points for cleanliness.'),
            (v_area_id, 'post-cleaning', 'Are all drip pans and catch trays under decoration equipment clean?', 'yes_no', 7, false, NULL,
             'Check all drip pans, crumb trays, and catch containers for complete removal of spilled product.'),
            (v_area_id, 'post-cleaning', 'Are all compressed air nozzles and blow-off stations clean and functional?', 'yes_no', 8, false, NULL,
             'Verify air knives, blow-off nozzles, and drying stations are clean and properly aimed.'),
            (v_area_id, 'post-cleaning', 'Are all ingredient totes and supply hoppers for decorations empty and clean?', 'yes_no', 9, false, NULL,
             'Check topping supply hoppers, ingredient totes, and dosing equipment for residue.'),
            (v_area_id, 'post-cleaning', 'Are all floors in the decoration area free of chocolate, toppings, and water?', 'yes_no', 10, false, NULL,
             'Inspect floors for any remaining chocolate, topping debris, or standing water.'),
            (v_area_id, 'post-cleaning', 'Are all drains in the decoration area clean and free-flowing?', 'yes_no', 11, false, NULL,
             'Check decoration area drains for chocolate residue or topping debris that may cause blockages.'),
            (v_area_id, 'post-cleaning', 'Are all guarding and safety interlocks clean and properly reinstalled?', 'yes_no', 12, false, NULL,
             'Verify all safety guards are clean, dry, and properly secured on decoration equipment.'),
            (v_area_id, 'post-cleaning', 'Are all vision system cameras and sensors clean and unobstructed?', 'yes_no', 13, false, NULL,
             'Clean and inspect all camera lenses, photo eyes, and detection sensors on the decoration line.'),
            (v_area_id, 'post-cleaning', 'Are all pneumatic cylinders and actuators clean and free of debris?', 'yes_no', 14, false, NULL,
             'Inspect air cylinders, slide mechanisms, and pneumatic actuators for cleanliness.'),
            (v_area_id, 'post-cleaning', 'Are all transfer points between decoration and packaging clean?', 'yes_no', 15, false, NULL,
             'Check transfer conveyors and hand-off points between decoration and downstream processes.'),
            (v_area_id, 'post-cleaning', 'Photo: Decoration line overall cleanliness', 'photo', 16, false, NULL,
             'Take wide-angle photos showing the complete decoration line after sanitation.'),
            (v_area_id, 'post-cleaning', 'Photo: Clean enrober and topping equipment', 'photo', 17, false, NULL,
             'Take close-up photos of enrobing and topping equipment to verify complete cleaning.');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- AREA 3: MACY Oven — 4 items (1 pre-cleaning + 3 post-cleaning)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_area_id UUID;
BEGIN
    SELECT id INTO v_area_id FROM areas WHERE name = 'MACY Oven';

    IF v_area_id IS NOT NULL THEN
        -- PRE-CLEANING (1 item)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'pre-cleaning', 'How many pieces of oven ancillary equipment have been covered?', 'count', 1, true, 'equipment_covered',
             'Count all provers, loaders, unloaders, and cooling racks that have been covered for protection.');

        -- POST-CLEANING (3 items)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'post-cleaning', 'Are all oven exterior surfaces, doors, and frames clean and free of grease?', 'yes_no', 2, false, NULL,
             'Inspect oven exterior panels, door seals, observation windows, and frame structures for grease and residue.'),
            (v_area_id, 'post-cleaning', 'Are all oven loading and unloading conveyors completely clean?', 'yes_no', 3, false, NULL,
             'Check infeed and outfeed conveyors, transfer mechanisms, and pan handling equipment for buildup.'),
            (v_area_id, 'post-cleaning', 'Are all oven area floors, walls, and ventilation hoods clean?', 'yes_no', 4, false, NULL,
             'Inspect surrounding floors, walls, and exhaust hoods for grease accumulation and debris.');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- AREA 4: MACY Spiral — 5 items (1 pre-cleaning + 4 post-cleaning)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_area_id UUID;
BEGIN
    SELECT id INTO v_area_id FROM areas WHERE name = 'MACY Spiral';

    IF v_area_id IS NOT NULL THEN
        -- PRE-CLEANING (1 item)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'pre-cleaning', 'How many pieces of spiral cooler equipment have been covered?', 'count', 1, true, 'equipment_covered',
             'Count all spiral conveyor frames, drive motors, and blower units that have been covered for protection.');

        -- POST-CLEANING (4 items)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'post-cleaning', 'Is the spiral conveyor belt clean and free of product residue?', 'yes_no', 2, false, NULL,
             'Inspect the full length of the spiral belt for embedded product, dough residue, or moisture.'),
            (v_area_id, 'post-cleaning', 'Are all spiral drum drives, tensioners, and sprockets clean?', 'yes_no', 3, false, NULL,
             'Check drum drive assemblies, belt tensioners, and sprocket engagement points for cleanliness.'),
            (v_area_id, 'post-cleaning', 'Are all evaporator coils and blower fans in the spiral cooler clean?', 'yes_no', 4, false, NULL,
             'Inspect refrigeration coils, drain pans, and circulation fans for frost buildup and debris.'),
            (v_area_id, 'post-cleaning', 'Are all spiral infeed and outfeed transfer points clean?', 'yes_no', 5, false, NULL,
             'Check product transfer points at spiral entry and exit for residue and proper alignment.');
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- AREA 5: MACY Palletizing — 8 items (1 pre-cleaning + 7 post-cleaning)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_area_id UUID;
BEGIN
    SELECT id INTO v_area_id FROM areas WHERE name = 'MACY Palletizing';

    IF v_area_id IS NOT NULL THEN
        -- PRE-CLEANING (1 item)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'pre-cleaning', 'How many pieces of palletizing equipment have been covered?', 'count', 1, true, 'equipment_covered',
             'Count all palletizers, depalletizers, case conveyors, and robotic arms that have been covered.');

        -- POST-CLEANING (7 items)
        INSERT INTO checklist_templates (area_id, phase, item_text, item_type, sequence_order, has_count, count_label, help_text)
        VALUES
            (v_area_id, 'post-cleaning', 'Are all palletizer infeed conveyors and lane dividers clean?', 'yes_no', 2, false, NULL,
             'Inspect case infeed conveyors, lane diverters, and sorting mechanisms for product residue.'),
            (v_area_id, 'post-cleaning', 'Are all palletizer heads, grippers, and pushers clean and functional?', 'yes_no', 3, false, NULL,
             'Check palletizer heads, suction cups, mechanical grippers, and pusher bars for buildup.'),
            (v_area_id, 'post-cleaning', 'Are all pallet magazines and dispensers clean?', 'yes_no', 4, false, NULL,
             'Inspect pallet magazines, dispensers, and stacking stations for debris and proper operation.'),
            (v_area_id, 'post-cleaning', 'Are all stretch wrapper frames, carriages, and film dispensers clean?', 'yes_no', 5, false, NULL,
             'Check stretch wrapper towers, film carriages, and cutting mechanisms for film residue.'),
            (v_area_id, 'post-cleaning', 'Are all case conveyor lines and roller sections clean?', 'yes_no', 6, false, NULL,
             'Inspect case conveyor rollers, chain drives, and transfer sections for accumulated debris.'),
            (v_area_id, 'post-cleaning', 'Are all palletizing area floors and drains clean and free of debris?', 'yes_no', 7, false, NULL,
             'Check floors, drain covers, and surrounding area for pallet splinters, packaging debris, and water.'),
            (v_area_id, 'post-cleaning', 'Are all case coding printers and label applicators clean?', 'yes_no', 8, false, NULL,
             'Inspect inkjet coders, label applicators, and print heads for ink buildup and proper function.');
    END IF;
END $$;

-- =============================================================================
-- VERIFICATION: Count seeded items
-- =============================================================================
-- SELECT areas.name AS area, checklist_templates.phase, COUNT(*) AS item_count
-- FROM checklist_templates
-- JOIN areas ON checklist_templates.area_id = areas.id
-- GROUP BY areas.name, checklist_templates.phase
-- ORDER BY areas.name, checklist_templates.phase;
--
-- Expected output:
--   MACY Decoration  | post-cleaning | 14
--   MACY Decoration  | pre-cleaning  |  3
--   MACY Oven        | post-cleaning |  3
--   MACY Oven        | pre-cleaning  |  1
--   MACY Palletizing | post-cleaning |  7
--   MACY Palletizing | pre-cleaning  |  1
--   MACY Production  | post-cleaning | 16
--   MACY Production  | pre-cleaning  |  3
--   MACY Spiral      | post-cleaning |  4
--   MACY Spiral      | pre-cleaning  |  1
--   TOTAL: 53
-- =============================================================================
