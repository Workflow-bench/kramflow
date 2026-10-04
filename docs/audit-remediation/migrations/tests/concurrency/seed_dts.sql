insert into display_type_state (event_id, display_type)
select id, 'presenter' from events where name = 'race-A';
