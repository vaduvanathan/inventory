-- 1. Create the Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  item_name TEXT PRIMARY KEY,
  total_stock INT DEFAULT 0,
  available_stock INT DEFAULT 0,
  in_transit_stock INT DEFAULT 0,
  deployed_stock INT DEFAULT 0
);

-- 2. Insert Initial Data (Modify these values as needed)
INSERT INTO inventory (item_name, total_stock, available_stock) VALUES
('Device', 100, 100),
('SD Card', 200, 200),
('Charger Hub', 50, 50),
('USB Cable', 100, 100)
ON CONFLICT (item_name) DO NOTHING;

-- 3. Add 'usb_cable_qty' to 'requests' table if it doesn't exist
ALTER TABLE requests ADD COLUMN IF NOT EXISTS usb_cable_qty INT DEFAULT 0;

-- 4. Create a stored procedure to handle Approval (Move from Available to In Transit)
CREATE OR REPLACE FUNCTION approve_request(request_id BIGINT, admin_name TEXT, tracking_courier TEXT, tracking_code TEXT)
RETURNS VOID AS $$
DECLARE
  req RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO req FROM requests WHERE id = request_id;
  
  -- Update request status
  UPDATE requests 
  SET status = 'approved', 
      approved_by = admin_name, 
      action_timestamp = NOW(),
      courier_name = tracking_courier,
      tracking_id = tracking_code
  WHERE id = request_id;

  -- Update Inventory: Move from Available -> In Transit
  UPDATE inventory SET available_stock = available_stock - req.device_qty, in_transit_stock = in_transit_stock + req.device_qty WHERE item_name = 'Device';
  UPDATE inventory SET available_stock = available_stock - req.sd_card_qty, in_transit_stock = in_transit_stock + req.sd_card_qty WHERE item_name = 'SD Card';
  UPDATE inventory SET available_stock = available_stock - req.charger_hub_qty, in_transit_stock = in_transit_stock + req.charger_hub_qty WHERE item_name = 'Charger Hub';
  UPDATE inventory SET available_stock = available_stock - req.usb_cable_qty, in_transit_stock = in_transit_stock + req.usb_cable_qty WHERE item_name = 'USB Cable';
END;
$$ LANGUAGE plpgsql;

-- 5. Create a stored procedure to handle Receipt (Move from In Transit to Deployed)
CREATE OR REPLACE FUNCTION receive_request(request_id BIGINT)
RETURNS VOID AS $$
DECLARE
  req RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO req FROM requests WHERE id = request_id;

  -- Update request status
  UPDATE requests SET status = 'completed' WHERE id = request_id;

  -- Update Inventory: Move from In Transit -> Deployed
  UPDATE inventory SET in_transit_stock = in_transit_stock - req.device_qty, deployed_stock = deployed_stock + req.device_qty WHERE item_name = 'Device';
  UPDATE inventory SET in_transit_stock = in_transit_stock - req.sd_card_qty, deployed_stock = deployed_stock + req.sd_card_qty WHERE item_name = 'SD Card';
  UPDATE inventory SET in_transit_stock = in_transit_stock - req.charger_hub_qty, deployed_stock = deployed_stock + req.charger_hub_qty WHERE item_name = 'Charger Hub';
  UPDATE inventory SET in_transit_stock = in_transit_stock - req.usb_cable_qty, deployed_stock = deployed_stock + req.usb_cable_qty WHERE item_name = 'USB Cable';
END;
$$ LANGUAGE plpgsql;