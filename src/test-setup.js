// Every date helper here is about local calendar days, so the suite has to run
// in a zone that actually observes DST - under UTC the DST cases pass without
// testing anything. Eastern is where this app is used.
process.env.TZ = 'America/New_York'
