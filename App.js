import React, {
  useState,
  useEffect,
  useRef,
} from "react";

import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Animated,
  SafeAreaView,
} from "react-native";

/* =========================
   WEATHER CODE MAPPING
========================= */

const WEATHER_CODES = {
  0: {
    label: "Cerah",
    emoji: "☀️",
  },
  1: {
    label: "Cerah Berawan",
    emoji: "🌤️",
  },
  2: {
    label: "Berawan Sebagian",
    emoji: "⛅",
  },
  3: {
    label: "Mendung",
    emoji: "☁️",
  },
  45: {
    label: "Berkabut",
    emoji: "🌫️",
  },
  51: {
    label: "Gerimis Ringan",
    emoji: "🌦️",
  },
  61: {
    label: "Hujan Ringan",
    emoji: "🌧️",
  },
  63: {
    label: "Hujan Sedang",
    emoji: "🌧️",
  },
  65: {
    label: "Hujan Lebat",
    emoji: "⛈️",
  },
  80: {
    label: "Hujan Lokal",
    emoji: "🌦️",
  },
  95: {
    label: "Badai Petir",
    emoji: "⚡",
  },
};

function getWeatherInfo(code) {
  return (
    WEATHER_CODES[code] || {
      label: "Tidak Diketahui",
      emoji: "❓",
    }
  );
}

/* =========================
   WIND DIRECTION
========================= */

function getWindDirection(
  degree = 0
) {
  const directions = [
    "U",
    "TL",
    "T",
    "TG",
    "S",
    "BD",
    "B",
    "BL",
  ];

  return directions[
    Math.round(degree / 45) % 8
  ];
}

/* =========================
   BACKGROUND COLOR
========================= */

function getBackgroundColor(
  weatherCode,
  isDay
) {
  if (!isDay) {
    return "#0f172a";
  }

  if (weatherCode === 0) {
    return "#4facfe";
  }

  if (
    [1, 2, 3].includes(
      weatherCode
    )
  ) {
    return "#64748b";
  }

  if (
    [61, 63, 65, 80].includes(
      weatherCode
    )
  ) {
    return "#334155";
  }

  return "#0f766e";
}

/* =========================
   APP
========================= */

export default function App() {
  const [searchInput, setSearchInput] =
    useState("");

  const [
    weatherData,
    setWeatherData,
  ] = useState(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [history, setHistory] =
    useState([]);

  const [
    favoriteCities,
    setFavoriteCities,
  ] = useState([]);

  const [
    multiCities,
    setMultiCities,
  ] = useState([]);

  const [refreshing, setRefreshing] =
    useState(false);

  const fadeAnim = useRef(
    new Animated.Value(0)
  ).current;

  /* =========================
     ANIMATION
  ========================= */

  const playFadeIn = () => {
    fadeAnim.setValue(0);

    Animated.timing(
      fadeAnim,
      {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }
    ).start();
  };

  /* =========================
     FETCH WEATHER
  ========================= */

  const fetchWeather =
    async (
      city,
      signal,
      saveToHistory = true
    ) => {
      const geoUrl =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(
          city
        )}` +
        `&count=1&language=id`;

      const geoRes =
        await fetch(
          geoUrl,
          {
            signal,
          }
        );

      const geoJson =
        await geoRes.json();

      if (
        !geoJson.results ||
        geoJson.results.length === 0
      ) {
        throw new Error(
          "Kota tidak ditemukan"
        );
      }

      const lokasi =
        geoJson.results[0];

      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lokasi.latitude}` +
        `&longitude=${lokasi.longitude}` +
        `&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,wind_direction_10m,is_day,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
        `&timezone=auto`;

      const weatherRes =
        await fetch(
          weatherUrl,
          {
            signal,
          }
        );

      const weatherJson =
        await weatherRes.json();

      const result = {
        kota: lokasi.name,
        negara:
          lokasi.country,
        suhu:
          weatherJson.current
            .temperature_2m,
        kelembaban:
          weatherJson.current
            .relative_humidity_2m,
        tekanan:
          weatherJson.current
            .pressure_msl,
        angin:
          weatherJson.current
            .wind_speed_10m,
        arahAngin:
          weatherJson.current
            .wind_direction_10m,
        kode:
          weatherJson.current
            .weather_code,
        isDay:
          weatherJson.current
            .is_day,
        harian:
          weatherJson.daily,
      };

      setWeatherData(
        result
      );

      playFadeIn();

      if (
        saveToHistory
      ) {
        setHistory(
          (prev) => {
            const updated =
              [
                lokasi.name,
                ...prev.filter(
                  (
                    item
                  ) =>
                    item !==
                    lokasi.name
                ),
              ];

            return updated.slice(
              0,
              5
            );
          }
        );
      }

      setError(null);

      return result;
    };  /* =========================
     DEBOUNCE SEARCH
  ========================= */

  useEffect(() => {
    if (!searchInput.trim()) {
      setWeatherData(null);
      setError(null);
      return;
    }

    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(
        async () => {
          try {
            setLoading(
              true
            );

            await fetchWeather(
              searchInput,
              controller.signal
            );
          } catch (err) {
            if (
              err.name !==
              "AbortError"
            ) {
              setError(
                err.message
              );

              setWeatherData(
                null
              );
            }
          } finally {
            setLoading(
              false
            );
          }
        },
        500
      );

    return () => {
      clearTimeout(
        timeoutId
      );

      controller.abort();
    };
  }, [searchInput]);

  /* =========================
     REFRESH WEATHER
  ========================= */

  const refreshWeather =
    async () => {
      if (
        !weatherData
      )
        return;

      try {
        setRefreshing(
          true
        );

        const controller =
          new AbortController();

        await fetchWeather(
          weatherData.kota,
          controller.signal,
          false
        );
      } catch (err) {
        console.log(
          err
        );
      } finally {
        setRefreshing(
          false
        );
      }
    };

  /* =========================
     FAVORITE CITY
  ========================= */

  const addFavorite =
    () => {
      if (
        !weatherData
      )
        return;

      const exists =
        favoriteCities.some(
          (
            city
          ) =>
            city.kota ===
            weatherData.kota
        );

      if (
        exists
      )
        return;

      setFavoriteCities(
        (
          prev
        ) => [
          ...prev,
          weatherData,
        ]
      );
    };

  const removeFavorite =
    (
      cityName
    ) => {
      setFavoriteCities(
        (
          prev
        ) =>
          prev.filter(
            (
              item
            ) =>
              item.kota !==
              cityName
          )
      );
    };

  /* =========================
     MULTI CITY
  ========================= */

  const addToMultiCity =
    async (
      city
    ) => {
      try {
        const controller =
          new AbortController();

        const data =
          await fetchWeather(
            city,
            controller.signal,
            false
          );

        const exists =
          multiCities.some(
            (
              item
            ) =>
              item.kota ===
              data.kota
          );

        if (
          exists
        )
          return;

        setMultiCities(
          (
            prev
          ) => [
            ...prev,
            data,
          ]
        );
      } catch (
        error
      ) {
        console.log(
          error
        );
      }
    };

  const removeMultiCity =
    (
      city
    ) => {
      setMultiCities(
        (
          prev
        ) =>
          prev.filter(
            (
              item
            ) =>
              item.kota !==
              city
          )
      );
    };

  const info =
    weatherData
      ? getWeatherInfo(
          weatherData.kode
        )
      : null;

  /* =========================
     UI
  ========================= */

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor:
          weatherData
            ? getBackgroundColor(
                weatherData.kode,
                weatherData.isDay
              )
            : "#0f172a",
      }}
    >
      <ScrollView
        contentContainerStyle={
          styles.container
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              refreshWeather
            }
          />
        }
      >
        <Text
          style={
            styles.title
          }
        >
          🌎 WeatherFinder
          Ultimate
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Real Time
          Weather
          Intelligence
        </Text>

        <TextInput
          style={
            styles.input
          }
          placeholder="Cari kota..."
          placeholderTextColor="#888"
          value={
            searchInput
          }
          onChangeText={
            setSearchInput
          }
        />

        {history.length >
          0 && (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              Riwayat
              Pencarian
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
            >
              {history.map(
                (
                  city,
                  index
                ) => (
                  <TouchableOpacity
                    key={
                      index
                    }
                    style={
                      styles.chip
                    }
                    onPress={() =>
                      setSearchInput(
                        city
                      )
                    }
                  >
                    <Text>
                      {
                        city
                      }
                    </Text>
                  </TouchableOpacity>
                )
              )}
            </ScrollView>
          </>
        )}

        {!searchInput &&
          (
            <View
              style={
                styles.emptyCard
              }
            >
              <Text
                style={
                  styles.emptyText
                }
              >
                🔍 Ketik
                nama kota
                untuk
                melihat
                cuaca
              </Text>
            </View>
          )}

        {loading && (
          <View
            style={
              styles.center
            }
          >
            <ActivityIndicator
              size="large"
              color="#fff"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Memuat
              data...
            </Text>
          </View>
        )}

        {error && (
          <View
            style={
              styles.errorCard
            }
          >
            <Text
              style={
                styles.errorText
              }
            >
              ❌ {error}
            </Text>
          </View>
        )}

        {weatherData &&
          !loading && (
            <Animated.View
              style={[
                styles.weatherCard,
                {
                  opacity:
                    fadeAnim,
                },
              ]}
            >
              <Text
                style={
                  styles.city
                }
              >
                {
                  weatherData.kota
                }
              </Text>

              <Text
                style={
                  styles.country
                }
              >
                {
                  weatherData.negara
                }
              </Text>

              <Text
                style={
                  styles.weatherEmoji
                }
              >
                {
                  info.emoji
                }
              </Text>

              <Text
                style={
                  styles.temperature
                }
              >
                {
                  weatherData.suhu
                }
                °C
              </Text>

              <Text
                style={
                  styles.status
                }
              >
                {
                  info.label
                }
              </Text>

              <Text
                style={
                  styles.dayText
                }
              >
                {weatherData.isDay
                  ? "☀️ Siang"
                  : "🌙 Malam"}
              </Text>              <View
                style={
                  styles.buttonRow
                }
              >
                <TouchableOpacity
                  style={
                    styles.actionButton
                  }
                  onPress={
                    refreshWeather
                  }
                >
                  <Text
                    style={
                      styles.actionButtonText
                    }
                  >
                    🔄 Refresh
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={
                    styles.actionButton
                  }
                  onPress={
                    addFavorite
                  }
                >
                  <Text
                    style={
                      styles.actionButtonText
                    }
                  >
                    ⭐ Favorit
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={
                    styles.actionButton
                  }
                  onPress={() =>
                    addToMultiCity(
                      weatherData.kota
                    )
                  }
                >
                  <Text
                    style={
                      styles.actionButtonText
                    }
                  >
                    ➕ Multi
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

        {weatherData &&
          !loading && (
            <>
              <View
                style={
                  styles.infoGrid
                }
              >
                <View
                  style={
                    styles.infoCard
                  }
                >
                  <Text
                    style={
                      styles.infoIcon
                    }
                  >
                    💧
                  </Text>

                  <Text>
                    {
                      weatherData.kelembaban
                    }
                    %
                  </Text>

                  <Text>
                    Kelembaban
                  </Text>
                </View>

                <View
                  style={
                    styles.infoCard
                  }
                >
                  <Text
                    style={
                      styles.infoIcon
                    }
                  >
                    🌪️
                  </Text>

                  <Text>
                    {
                      weatherData.angin
                    }
                  </Text>

                  <Text>
                    km/jam
                  </Text>
                </View>

                <View
                  style={
                    styles.infoCard
                  }
                >
                  <Text
                    style={
                      styles.infoIcon
                    }
                  >
                    🧭
                  </Text>

                  <Text>
                    {getWindDirection(
                      weatherData.arahAngin
                    )}
                  </Text>

                  <Text>
                    {
                      weatherData.arahAngin
                    }
                    °
                  </Text>
                </View>

                <View
                  style={
                    styles.infoCard
                  }
                >
                  <Text
                    style={
                      styles.infoIcon
                    }
                  >
                    📈
                  </Text>

                  <Text>
                    {
                      weatherData.tekanan
                    }
                  </Text>

                  <Text>
                    hPa
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.forecastTitle
                }
              >
                📅 Forecast 7 Hari
              </Text>

              {weatherData.harian.time.map(
                (
                  day,
                  index
                ) => (
                  <View
                    key={
                      index
                    }
                    style={
                      styles.forecastCard
                    }
                  >
                    <Text>
                      {day}
                    </Text>

                    <Text>
                      🔺
                      {
                        weatherData
                          .harian
                          .temperature_2m_max[
                          index
                        ]
                      }
                      °C
                    </Text>

                    <Text>
                      🔻
                      {
                        weatherData
                          .harian
                          .temperature_2m_min[
                          index
                        ]
                      }
                      °C
                    </Text>
                  </View>
                )
              )}
            </>
          )}

        {favoriteCities.length >
          0 && (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              ⭐ Kota Favorit
            </Text>

            {favoriteCities.map(
              (
                item,
                index
              ) => (
                <View
                  key={
                    index
                  }
                  style={
                    styles.favoriteCard
                  }
                >
                  <Text
                    style={
                      styles.favoriteText
                    }
                  >
                    {
                      item.kota
                    }
                    ,
                    {" "}
                    {
                      item.negara
                    }
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      removeFavorite(
                        item.kota
                      )
                    }
                  >
                    <Text>
                      ❌
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            )}
          </>
        )}

        {multiCities.length >
          0 && (
          <>
            <Text
              style={
                styles.sectionTitle
              }
            >
              🌍 Multi Kota
            </Text>

            <FlatList
              scrollEnabled={
                false
              }
              data={
                multiCities
              }
              keyExtractor={(
                item,
                index
              ) =>
                index.toString()
              }
              renderItem={({
                item,
              }) => {
                const info =
                  getWeatherInfo(
                    item.kode
                  );

                return (
                  <View
                    style={
                      styles.multiCard
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.multiCity
                        }
                      >
                        {
                          item.kota
                        }
                      </Text>

                      <Text>
                        {
                          info.label
                        }
                      </Text>
                    </View>

                    <View>
                      <Text
                        style={
                          styles.multiTemp
                        }
                      >
                        {
                          item.suhu
                        }
                        °C
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() =>
                        removeMultiCity(
                          item.kota
                        )
                      }
                    >
                      <Text>
                        ❌
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      padding: 20,
      paddingBottom: 50,
    },

    title: {
      fontSize: 30,
      fontWeight: "bold",
      color: "#fff",
      textAlign: "center",
      marginTop: 20,
    },

    subtitle: {
      color: "#fff",
      textAlign: "center",
      marginBottom: 20,
    },

    input: {
      backgroundColor:
        "#fff",
      borderRadius: 15,
      padding: 15,
      fontSize: 16,
    },

    sectionTitle: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "bold",
      marginTop: 20,
      marginBottom: 10,
    },

    chip: {
      backgroundColor:
        "#fff",
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 10,
    },

    emptyCard: {
      backgroundColor:
        "rgba(255,255,255,0.2)",
      borderRadius: 15,
      padding: 20,
      marginTop: 20,
    },

    emptyText: {
      color: "#fff",
      textAlign: "center",
    },

    center: {
      alignItems: "center",
      marginTop: 30,
    },

    loadingText: {
      color: "#fff",
      marginTop: 10,
    },

    weatherCard: {
      backgroundColor:
        "rgba(255,255,255,0.25)",
      borderRadius: 25,
      padding: 25,
      marginTop: 20,
      alignItems: "center",
    },

    city: {
      color: "#fff",
      fontSize: 28,
      fontWeight: "bold",
    },

    country: {
      color: "#fff",
    },

    weatherEmoji: {
      fontSize: 70,
    },

    temperature: {
      color: "#fff",
      fontSize: 55,
      fontWeight: "bold",
    },

    status: {
      color: "#fff",
      fontSize: 18,
    },

    dayText: {
      color: "#fff",
      marginTop: 10,
    },

    buttonRow: {
      flexDirection: "row",
      marginTop: 20,
      gap: 10,
    },

    actionButton: {
      backgroundColor:
        "#fff",
      padding: 10,
      borderRadius: 15,
    },

    actionButtonText: {
      fontWeight: "bold",
    },

    infoGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent:
        "space-between",
      marginTop: 20,
    },

    infoCard: {
      width: "48%",
      backgroundColor:
        "#fff",
      borderRadius: 20,
      padding: 20,
      alignItems: "center",
      marginBottom: 15,
    },

    infoIcon: {
      fontSize: 28,
    },

    forecastTitle: {
      color: "#fff",
      fontSize: 22,
      fontWeight: "bold",
      marginVertical: 15,
    },

    forecastCard: {
      backgroundColor:
        "#fff",
      borderRadius: 15,
      padding: 15,
      marginBottom: 10,
      flexDirection: "row",
      justifyContent:
        "space-between",
    },

    favoriteCard: {
      backgroundColor:
        "#fff",
      borderRadius: 15,
      padding: 15,
      flexDirection: "row",
      justifyContent:
        "space-between",
      marginBottom: 10,
    },

    favoriteText: {
      fontWeight: "bold",
    },

    multiCard: {
      backgroundColor:
        "#fff",
      borderRadius: 15,
      padding: 15,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 10,
    },

    multiCity: {
      fontWeight: "bold",
      fontSize: 16,
    },

    multiTemp: {
      fontWeight: "bold",
      fontSize: 20,
    },

    errorCard: {
      backgroundColor:
        "#fff",
      borderRadius: 15,
      padding: 20,
      marginTop: 20,
    },

    errorText: {
      color: "red",
      fontWeight: "bold",
    },
  });