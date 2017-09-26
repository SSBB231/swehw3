//================================ Global Variable Declarations ====================================
//Setting stuff up
const express = require('express');
var fetch = require('node-fetch');
const app = express();
var router = express.Router();
const port = process.env.PORT || 5000;

//Holds the entire cached database
let dataset;

//Reference to this app's track manager
let tManager;
//=============================== End of Global Variables ===========================================


/*
Computed Resources
- Average cost per minute in respect to each artist
- Percentage explicit tracks per artist
- Collection price vs sum of prices per track

Regulars
- Return all artists
- Return all tracks by an artist

New Resources
- Retrieve the artist with the most tracks
-

Update
- Update artist tracks
- Add an artist with all of his/her tracks
- Delete all tracks associated with an artist

Ask for artist will ask itunes API for new one if not already in the cached database (baseline top 100)
delete will only delete from the cached database
*/

//=============================== Class Declarations ================================================

class TrackManager
{
    constructor(dSet)
    {
        // console.log(dSet);
        this.bySong = new Map();
        this.artists = new Map();
        this.dSet = dSet;
    }

    getArtists()
    {
        let arts = [];
        for (let artist of this.artists.values())
        {
            arts.push(artist);
        }

        return arts;
    }

    // getAllArtists()
    // {
    //     let arts = [];
    //     for(let a of this.artists)
    //     {
    //         arts.push(a.aName);
    //     }
    //
    //     return arts;
    // }
    //
    // getAllArtistNames()
    // {
    //     let artistNames = new Set();
    //
    //     for(let track of this.dSet.results)
    //     {
    //         artistNames.add(track.artistName);
    //     }
    //
    //     return artistNames;
    // }

    populate()
    {
        let artistSet = new Set();

        for (let track of this.dSet.results)
        {
            if (track.kind === "song")
            {
                this.bySong.set(track.trackName, track);
                artistSet.add(track.artistName);
                //       console.log("Track Added");
                //      console.log(track.artistName);
            }
            else
            {
                console.log(track.kind);
            }
        }

        for (let theArtist of artistSet)
        {
            this.artists.set(theArtist, new Artist(theArtist, this.groupAllTracksFor(theArtist)));
        }
    }

    groupAllTracksFor(artist)
    {
        let tracks = new Set();
        for (let track of this.dSet.results)
        {
            if (track.artistName === artist)
                tracks.add(track);
        }

        return Array.from(tracks);
    }

    addTrack(trackName, track)
    {
        this.bySong.set(trackName, track);
    }

    addArtist(artistName)
    {
        this.artists.set(artistName, new Artist(artistName,))
    }
}

class Artist
{
    constructor(aName, tList)
    {
        this.aName = aName;
        this.tList = tList;
    }
}

//================================ End of Class Declarations ==========================================


//============================== Global Function Declarations ========================================

let averageTrackPriceFor = function (artist)
{
    let tracks = artist.tList;
    let duration = 0;
    let cost = 0;
    for (let track of tracks)
    {
        duration += track.trackTimeMillis / 60000; //converting milliseconds to minutes
        cost += track.trackPrice;
    }

    return cost / duration;
};

let percentExplicit = function (artist)
{
    let tracks = artist.tList;
    let countExplicit = 0;
    for (let track of tracks)
    {
        //console.log(track.trackExplicitness);
        if (track.trackExplicitness === "explicit")
        {
            countExplicit++;
        }
    }
    return countExplicit / tracks.length * 100;
};

let savings = function (response, track)
{
    fetch(`https://itunes.apple.com/lookup?id=${track.collectionId}&entity=song`).then(function (res)
    {
        return res.json();
    }).then(function (json)
    {
        console.log(json);
        let collectionCost = json.results[0].collectionPrice;
        console.log(collectionCost);
        let sumPrice = 0;
        for (let track of json.results)
        {
            if (track.kind === "song")
            {
                sumPrice += track.trackPrice;
            }
        }

        let difference = collectionCost - sumPrice;
        console.log(difference);

        if (difference < 0)
        {
            let retVal = "If you buy the album, you save: " + -difference.toFixed(2);
            console.log("=========================" + retVal)
            response.send(retVal);
        }
        else
        {
            let retVal = "You save: " + difference.toFixed(2) + " by buying the songs individually";
            response.send(retVal);
        }
    });
};


//====================== New functions for this homework ============================================

function retrieveDataFromServer()
{
    //Get first half of data
    Promise.all([getFirstHalfData(), getSecondHalfData()])
        .then((res)=>console.log("Retrieved all Data"))
        .catch(()=>console.log("Failed to Retrieve all Data"));
}

//Counts the number of JSON objects contained in this app's cache
function countJSON()
{
    let count;
    for (count in dataset.results);
    console.log(count);
}

function getFirstHalfData()
{
    return fetch('https://itunes.apple.com/search?term=top+pop+hits&limit=110')
        .then(function (res)
        {
            return res.json();
        })
        .then(function (json)
        {
            dataset = json;
            tManager = new TrackManager(dataset);
            tManager.populate();
            countJSON();
        });
}


function getSecondHalfData()
{
    return fetch('https://itunes.apple.com/search?term=top+alternative&limit=110')
        .then(function (res)
        {
            return res.json();
        })
        .then(function (json)
        {
            dataset.results = dataset.results.concat(json.results);
            tManager = new TrackManager(dataset);
            tManager.populate();
            countJSON();
        })
        .catch(() =>
        {
            console.log("Failed to fetch alternative rock");
        });
}


//============================ End of functions for this homework ===================================




//============================== URI Handling and HTTP Requests ==================================
router.route('/artists').get(function (req, res)
{
    res.send(JSON.stringify(tManager.getArtists()));
});

router.route('/artists/:aName').get(function (req, res)
{
    let artistName = req.params.aName.replace(/_/gi, " ");
    //
    // res.send(JSON.stringify(tManager.artists.get(artistName).tList));

    if (tManager.artists.get(artistName) === undefined)
    {
        res.status(500).send(artistName + " is not cached in the local database." +
            "\nPlease make a POST request for " + artistName + " and try again.");
    }
    else
    {
        res.send(JSON.stringify(tManager.artists.get(artistName).tList));
    }
});

router.route('/artists/:aName/average')
    .get(function (req, res)
    {
        let artistName = req.params.aName.replace(/_/gi, " ");

        res.send("Average cost per minute is: $" + averageTrackPriceFor(tManager.artists.get(artistName)).toFixed(2));
    });
//
router.route('/artists/:aName/explicit')
    .get(function (req, res)
    {
        let artistName = req.params.aName.replace(/_/gi, " ");

        res.send("Percentage of Explicit tracks: " + percentExplicit(tManager.artists.get(artistName)).toFixed(2) + "%");
    });
//
router.route('/artists/:aName/tracks/:tName/savings')
    .get(function (req, res)
    {
        let trackName = req.params.tName.replace(/_/gi, " ");

        savings(res, tManager.bySong.get(trackName));
    });

router.use(function (req, res, next)
{
    console.log('Here there be dragons');
    next();
});

router.get('/', (req, res) =>
{
    res.json({message: 'things are happening'});
});


router.route('/artists/:aName')


    .post(function (req, res)
    {
        let artistName = req.params.aName.replace(/_/gi, "%20");

        fetch(`https://itunes.apple.com/search?term=${artistName}`)
            .then(function (res)
            {
                return res.json();
            })
            .then(function (json)
            {
                artistName = artistName.replace(/%20/gi, " ");
                let foundSomething = false;
                for (let tempJson of json.results)
                {
                    if (tempJson.artistName === artistName)
                    {
                        dataset.results = [...dataset.results, tempJson];
                    }
                }

                tManager = new TrackManager(dataset);
                tManager.populate();
                console.log(artistName);
                //  console.log(tManager.artists.get(artistName));
                res.send(JSON.stringify(dataset.results));
                //            if(dataset.results === undefined)
                // 			{
                //                //dataset = json;
                // 				console.log(dataset);
                //                tManager = new TrackManager(dataset);
                //                tManager.populate();
                // 			}
                // 			else
                // 			{
                // 				console.log("firin' up mah lazars");
                // 				//console.log(json.results);
                // 				//dataset.results = [...dataset.results, ...json.results];
                // 			//	tManager = new TrackManager(dataset);
                // 				tManager.populate();
                // //				console.log(dataset.results);
                // 			//	res.send(`Added new artist: ${artistName}`);
                // 				res.send(JSON.stringify(dataset.results));
                // 			}
            });
    })
    .put(function (req, res)
    {
        let artistName = req.params.aName.replace(/_/gi, "%20");

        fetch(`https://itunes.apple.com/search?term=${artistName}`)
            .then(function (res)
            {
                return res.json();
            })
            .then(function (json)
            {
                if (dataset.results === undefined)
                {
                    dataset = json;
                    // console.log(dataset);
                    tManager = new TrackManager(dataset);
                    tManager.populate();
                }
                else
                {
                    dataset.results = [...dataset.results, ...json.results];
                    tManager = new TrackManager(dataset);
                    tManager.populate();
                    console.log(tManager.artists.get(req.params.aName).tList);
                    res.send(JSON.stringify(dataset.results));
                }
            });
    })
    .get(function (req, res)
    {
        let artistName = req.params.aName.replace(/_/gi, " ");
        //      console.log(tManager.artists.get(artistName));
        res.send(JSON.stringify(tManager.artists.get(artistName).tList));
    })
    .delete(function (req, res)
    {
        let artist = req.params.aName.replace(/_/gi, " ");

        if (tManager.artists.get(artist) === undefined)
        {
            res.status(500).send("doesn't exist");
        }
        else
        {
            console.log(artist);
            for (let i = dataset.results.length - 1; i > -1; i--)
            {
                //   console.log(dataset.results[i]);
                //   console.log(dataset.results[i].artistName);
                if (dataset.results[i].artistName === artist)
                {
                    dataset.results.splice(i, 1);
                    console.log('Deleted an artist entry');
                }
            }
            tManager = new TrackManager(dataset);
            tManager.populate();
        }
        res.send('Deleted all entries of that artist');
    });

//============================== End of URI Handling and HTTP Requests =================================


//Start the app and listen for stuff
app.use('', router);
retrieveDataFromServer();
app.listen(port);